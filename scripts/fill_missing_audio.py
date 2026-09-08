#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
按**文本**补齐缺失音频（跨教材共用）。

核心认知（2026-09-07 用户指出后核实）：
  manifest 是「小写文本 -> 词条 id」的映射，**与教材线无关**。
  同一单词在人教/外研/仁爱里都指向同一个 key ⇒ 只要这个文本有音频，
  所有教材线都能播。所以「某教材线缺音频」要按**去重后的文本**统计，
  而不是按 ra-/wy- 文件数统计。

  实测覆盖率：人教 100%、牛津 100%、仁爱 99.8%（仅 5 条）、
  外研 91.3%（96 条）⇒ 真正要生成的是这 96 + 5 条，不是几百条。

策略：有道优先（type=2 美 / type=1 英），产出不可用（非 200 / 超长 / 过小）
才用 Edge 兜底（en-US-AriaNeural / en-GB-SoniaNeural）。

用法：
  python scripts/fill_missing_audio.py --dry-run
  python scripts/fill_missing_audio.py
输入：scripts/.missing_texts.json（由 verify 脚本导出，含 id 与原始拼写）
"""
import asyncio
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
MISSING = ROOT / "scripts" / ".missing_texts.json"

VOICE_US = "en-US-AriaNeural"
VOICE_UK = "en-GB-SoniaNeural"

MIN_BYTES = 1_000
MAX_BYTES = 60_000  # 有道偶发返回 130KB+ 的异常长音频（疑含例句），判为不可用

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def sanitize(text: str) -> str:
    """送给 TTS 的文本：省略号念不出来，去掉"""
    return text.replace("...", "").replace("…", "").strip()


def youdao(text: str, type_no: int, out: Path):
    url = (
        "https://dict.youdao.com/dictvoice?audio="
        + urllib.parse.quote(text)
        + f"&type={type_no}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read()
    except Exception as e:
        return f"ERR {e}"
    if len(data) < MIN_BYTES:
        return f"TOO_SMALL {len(data)}"
    if len(data) > MAX_BYTES:
        return f"TOO_BIG {len(data)}"
    out.write_bytes(data)
    return len(data)


async def edge(text: str, out: Path, voice: str, sem):
    import edge_tts

    async with sem:
        for attempt in range(4):
            try:
                comm = edge_tts.Communicate(text, voice)
                await comm.save(str(out))
                return out.stat().st_size
            except Exception as e:
                if attempt == 3:
                    return f"ERR {e}"
                await asyncio.sleep(1.5 * (attempt + 1))


def load_targets():
    data = json.loads(MISSING.read_text(encoding="utf-8"))
    seen = {}
    for line in data.values():
        for item in line:
            seen[item["id"]] = item
    return list(seen.values())


async def main():
    dry = "--dry-run" in sys.argv
    targets = load_targets()
    print(f"待补文本 {len(targets)} 条（已按 id 去重，跨线共用）\n")

    sem = asyncio.Semaphore(6)
    ok_us = ok_uk = 0
    man_us = json.loads((AUDIO / "manifest.json").read_text(encoding="utf-8"))
    man_uk = json.loads((AUDIO / "manifest-uk.json").read_text(encoding="utf-8"))

    for it in targets:
        rid, en = it["id"], it["en"]
        text = sanitize(en)
        key = en.strip().lower()
        f_us = AUDIO / f"{rid}.mp3"
        f_uk = AUDIO / f"{rid}-uk.mp3"

        res_us = res_uk = None
        src_us = src_uk = ""

        # --- 美音 ---
        if f_us.exists() and MIN_BYTES <= f_us.stat().st_size <= MAX_BYTES:
            res_us, src_us = f_us.stat().st_size, "已有"
        elif not dry:
            r = youdao(text, 2, f_us)
            if isinstance(r, int):
                res_us, src_us = r, "有道"
            else:
                r2 = await edge(text, f_us, VOICE_US, sem)
                res_us, src_us = r2, f"Edge(有道{r})"

        # --- 英音 ---
        if f_uk.exists() and MIN_BYTES <= f_uk.stat().st_size <= MAX_BYTES:
            res_uk, src_uk = f_uk.stat().st_size, "已有"
        elif not dry:
            r = youdao(text, 1, f_uk)
            if isinstance(r, int):
                res_uk, src_uk = r, "有道"
            else:
                r2 = await edge(text, f_uk, VOICE_UK, sem)
                res_uk, src_uk = r2, f"Edge(有道{r})"

        if res_us and isinstance(res_us, int):
            ok_us += 1
        if res_uk and isinstance(res_uk, int):
            ok_uk += 1

        # manifest 按**文本**登记；已有映射（指向别的教材线的文件）不动
        man_us.setdefault(key, rid)
        man_uk.setdefault(key, rid)

        flag = "" if (isinstance(res_us, int) and isinstance(res_uk, int)) else "  ❌"
        print(
            f"{rid:20s} «{en}» us={res_us}({src_us}) uk={res_uk}({src_uk}){flag}"
        )

    if dry:
        print("\n--dry-run：未写入")
        return

    # 保持原格式：单行紧凑 JSON、键按插入顺序（新增的追加在末尾，diff 最小）
    dump = lambda m: json.dumps(m, ensure_ascii=False, separators=(",", ":"))
    (AUDIO / "manifest.json").write_text(dump(man_us), encoding="utf-8")
    (AUDIO / "manifest-uk.json").write_text(dump(man_uk), encoding="utf-8")
    print(f"\n完成 美音 {ok_us}/{len(targets)}，英音 {ok_uk}/{len(targets)}")
    print(f"manifest 条目：{len(man_us)} / {len(man_uk)}")


if __name__ == "__main__":
    asyncio.run(main())
