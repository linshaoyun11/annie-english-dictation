#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
仁爱线音频「兜底修复」：把有道产出**不可用**的文件改用 Edge TTS 重生成。

触发原因（2026-09-07）：
  1. 有道 dictvoice 对部分词返回**超长音频**（实测 grassland 141KB / indoors 132KB，
     疑含例句或异常录音），单条单词不应有 30 秒。
  2. 误启动的 Edge 全量重生成任务在 22:51 覆写了 1 个有道文件（ra-g7u1e0013），
     另留下 1 个 0 字节残文件（ra-g7u6e0535）。

策略（用户指示「有道优先、EDGE 兜底」）：
  有道产出不可用时（超长 / 0 字节 / 缺失）才用 Edge 补，其余有道文件**不动**。

语音（与存量 Edge 库一致）：美音 en-US-AriaNeural / 英音 en-GB-SoniaNeural

用法：
  python scripts/fix_renai_oversized.py --dry-run   # 只列出待修文件
  python scripts/fix_renai_oversized.py             # 实际重生成
"""
import asyncio
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
RENAI = ROOT / "src" / "data" / "renai.ts"
MAN_US = AUDIO / "manifest.json"

VOICE_US = "en-US-AriaNeural"
VOICE_UK = "en-GB-SoniaNeural"

MAX_BYTES = 60_000  # 超过即视为有道异常产出
MIN_BYTES = 1_000   # 小于即视为残缺（含 0 字节）

# 有道 HTTP 500 拿不到的条目（scripts/audio_renai_*_failed.log），只能靠 Edge 兜底。
# 键 = ra- id，值 = 送给 TTS 的文本（省略号要让 TTS 念得出来，故去掉 " ... "）。
FAILED_IDS = {
    "ra-g9u29e2014": "self-driving",
    "ra-g9u29e2024": "the Asia-Pacific area",
    "ra-g9u31e2139": "world-famous",
    "ra-g9u35e2268": "would rather than",
    "ra-g9u36e2302": "in one's view",
}

MK_RE = re.compile(
    r'mk\(\s*"ra"\s*,\s*(\d+),\s*(\d+),\s*"(?:word|phrase|sentence)"\s*,\s*"((?:[^"\\]|\\.)*)"'
)


def build_id_map():
    """按 mk 调用顺序重建 ra- id（与 mkWithPrefix 一致）"""
    src = RENAI.read_text(encoding="utf-8")
    out = {}
    n = 0
    for m in MK_RE.finditer(src):
        g, u, eng = int(m.group(1)), int(m.group(2)), m.group(3)
        n += 1
        out[f"ra-g{g}u{u}e{n:04d}"] = eng
    return out


def reverse_manifest():
    """id -> 小写英文（id 映射表里查不到时的兜底）"""
    man = json.loads(MAN_US.read_text(encoding="utf-8"))
    return {v: k for k, v in man.items()}


async def gen_one(text, out_path, voice, sem):
    import edge_tts
    async with sem:
        for attempt in range(4):
            try:
                comm = edge_tts.Communicate(text, voice)
                await comm.save(str(out_path))
                return out_path.stat().st_size
            except Exception as e:
                if attempt == 3:
                    return f"ERR {e}"
                await asyncio.sleep(1.5 * (attempt + 1))


async def main():
    dry = "--dry-run" in sys.argv
    id_map = build_id_map()
    rev = reverse_manifest()

    targets = []
    for f in sorted(AUDIO.glob("ra-*.mp3")):
        size = f.stat().st_size
        if size >= MIN_BYTES and size <= MAX_BYTES:
            continue
        stem = f.name[:-4]
        is_uk = stem.endswith("-uk")
        rid = stem[:-3] if is_uk else stem
        text = id_map.get(rid) or rev.get(rid)
        if not text:
            print(f"  ⚠️ 跳过（查不到原文）: {f.name} {size}B")
            continue
        # manifest 反查拿到的是小写，id_map 拿到的是原始拼写；优先 id_map
        # 星号是词表里的标记符号（如 *hungry），TTS 不能念出来
        text = text.strip().lstrip("*").strip()
        if not text:
            print(f"  ⚠️ 跳过（原文为空）: {f.name} {size}B")
            continue
        targets.append((f, rid, text, VOICE_UK if is_uk else VOICE_US, size))

    # 有道 500 失败项：文件缺失的一律补（美音 + 英音）
    for rid, text in FAILED_IDS.items():
        for suffix, voice in (("", VOICE_US), ("-uk", VOICE_UK)):
            f = AUDIO / f"{rid}{suffix}.mp3"
            if f.exists() and f.stat().st_size >= MIN_BYTES:
                continue
            targets.append((f, rid, text, voice, f.stat().st_size if f.exists() else 0))

    targets.sort(key=lambda t: t[0].name)
    seen = set()
    targets = [t for t in targets if not (t[0].name in seen or seen.add(t[0].name))]

    print(
        f"待处理 {len(targets)} 个"
        f"（超长 >{MAX_BYTES}B / 残缺 <{MIN_BYTES}B / 有道失败项缺失）"
    )
    for f, rid, text, voice, size in targets:
        print(f"  {f.name:32s} {size:>8d}B  {voice}  «{text}»")

    if dry or not targets:
        return

    sem = asyncio.Semaphore(6)
    tasks = [gen_one(t[2], t[0], t[3], sem) for t in targets]
    results = await asyncio.gather(*tasks)

    ok = 0
    for (f, rid, text, voice, size), r in zip(targets, results):
        if isinstance(r, int):
            ok += 1
            print(f"  ✅ {f.name} {size}B -> {r}B")
        else:
            print(f"  ❌ {f.name} {r}")
    print(f"\n完成 {ok}/{len(targets)}")


if __name__ == "__main__":
    asyncio.run(main())
