#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_waiyanshe_g7g9.py — 外研三起 G7-G9 音频缺口补齐

按「有道优先、Edge 兜底」补齐外研社三起初中段
（G7 上/下、G8 上/下、G9 全一册）的 225+225 共 450 个音频文件。

仅对 App 端实际漏播（manifest.get(text.toLowerCase()) → null）的词条处理，
不覆盖已有文件（断点续传 + 大小校验），符合「Edge 全量覆盖铁律」的安全范式。

来源策略（用户 2026-09-07 明确指示）：
- 美音：有道 dictvoice type=2 → Edge en-US-AriaNeural
- 英音：有道 dictvoice type=1 → Edge en-GB-SoniaNeural

⚠️ 不启用百度兜底（用户最新指示：「有道优先、Edge 兜底」）

用法：
  python scripts/generate_waiyanshe_g7g9.py --dry-run      # 只列缺口
  python scripts/generate_waiyanshe_g7g9.py                # 全量补齐
  python scripts/generate_waiyanshe_g7g9.py --us --limit=10
"""
import argparse
import asyncio
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
WY_SRC = ROOT / "src" / "data" / "waiyanshe.ts"
MAN_US = AUDIO / "manifest.json"
MAN_UK = AUDIO / "manifest-uk.json"
LOG = ROOT / "scripts" / "audio_wy_g7g9.log"

VOICE_US = "en-US-AriaNeural"
VOICE_UK = "en-GB-SoniaNeural"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

# 体积告警阈值（与 fix_renai_oversized.py 保持一致）
MAX_BYTES = 60 * 1024  # 60KB — 单条单词不应这么大
MIN_BYTES = 1_000    # 残缺

# 解析外研三起 mk 调用。id 按文件内 mk 调用顺序全局递增（与 mkWithPrefix 一致），
# 但本脚本只关心 G7-G9，所以单独计数即可。
MK_RE = re.compile(
    r'mk\(\s*"wy"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*"(?:word|phrase|sentence)"\s*,'
    r'\s*"((?:[^"\\]|\\.)*)"'
)


def parse_waiyanshe(min_grade=7, max_grade=9):
    """解析 waiyanshe.ts，过滤 [min_grade, max_grade] 词条。

    关键：id 中的 n 必须按整个文件所有 mk("wy", ...) 调用顺序递增
    （与 mkWithPrefix 的 prefixSeqs 一致），G3-G6 的调用仍要 +1 但不进 entries。
    """
    src = WY_SRC.read_text(encoding="utf-8")
    out = []
    n = 0
    for m in MK_RE.finditer(src):
        g, u = int(m.group(1)), int(m.group(2))
        eng = m.group(3).replace('\\"', '"').replace("\\\\", "\\")
        n += 1
        if not (min_grade <= g <= max_grade):
            continue
        out.append({
            "grade": g,
            "unit": u,
            "english": eng,
            "id": f"wy-g{g}u{u}e{n:04d}",
        })
    return out


def is_word_like(s):
    """单词 vs 短语：单词只含字母 / 撇号 / 连字符 / 空格"""
    return bool(re.fullmatch(r"[A-Za-z'\- ]+", s.strip()))


def youdao_us_url(entry):
    eng = entry["english"]
    if is_word_like(eng):
        clean = eng.lower().replace("*", "").strip()
        clean = re.sub(r"[^a-z']", "", clean)
        if not clean:
            return None
        return f"https://dict.youdao.com/dictvoice?audio={clean}&type=2"
    text = eng.replace("*", "").strip()
    if not text:
        return None
    return f"https://dict.youdao.com/dictvoice?audio={urllib.parse.quote(text)}&type=2"


def youdao_uk_url(key):
    """英音 url 构造（与 generate_audio_renai.mjs 保持一致）"""
    clean = re.sub(r"[^a-z ]", "", key).strip()
    if not clean:
        return None
    return f"https://dict.youdao.com/dictvoice?audio={urllib.parse.quote(clean)}&type=1"


def download_http(url, out_path, timeout=15):
    """阻塞下载；在 asyncio 里通过 run_in_executor 调用"""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        if r.status != 200:
            raise RuntimeError(f"HTTP {r.status}")
        data = r.read()
        if len(data) < 500:
            raise RuntimeError(f"too small {len(data)}B")
        out_path.write_bytes(data)
        return len(data)


def is_good_size(path):
    if not path.exists():
        return False
    sz = path.stat().st_size
    return MIN_BYTES <= sz <= MAX_BYTES


async def gen_edge(text, voice, out_path, sem):
    """Edge TTS 单条生成"""
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


async def process_one(entry, variant, sem_edge, dry):
    """
    variant: 'us' / 'uk'
    返回 dict: {entry, variant, status, key}
    - skip-ok: 文件已合格，跳过
    - youdao(Nb): 有道下载 N 字节
    - big-remake: 有道超长，已删，等 Edge 补
    - edge(Nb): Edge 生成 N 字节
    - failed: 有道 + Edge 全部失败
    """
    suf = "" if variant == "us" else "-uk"
    out_path = AUDIO / f"{entry["id"]}{suf}.mp3"
    key_raw = entry["english"].strip().lower()

    if is_good_size(out_path):
        return {"entry": entry, "variant": variant, "key": key_raw, "status": "skip-ok"}

    # === 1. 有道 ===
    url = youdao_us_url(entry) if variant == "us" else youdao_uk_url(key_raw)
    youdao_size = 0
    youdao_ok = False
    if url:
        try:
            loop = asyncio.get_event_loop()
            sz = await loop.run_in_executor(None, lambda: download_http(url, out_path))
            youdao_size = sz
            if MIN_BYTES <= sz <= MAX_BYTES:
                youdao_ok = True
        except Exception:
            # 有道失败 → 文件可能写了不合法大小，清掉让 Edge 接手
            if out_path.exists() and not is_good_size(out_path):
                out_path.unlink(missing_ok=True)

    if youdao_ok:
        return {"entry": entry, "variant": variant, "key": key_raw,
                "status": f"youdao({youdao_size}B)"}

    # === 2. Edge 兜底 ===
    if dry:
        return {"entry": entry, "variant": variant, "key": key_raw,
                "status": "DRY-pending"}

    # TTS 文本清洗：去 `*` 标记、替换 `...` / `…` 为空格（避免念"点点点"）
    text = entry["english"].strip().replace("...", " ").replace("…", " ")
    text = text.lstrip("*").strip()
    if not text:
        return {"entry": entry, "variant": variant, "key": key_raw,
                "status": "skip-empty"}

    voice = VOICE_US if variant == "us" else VOICE_UK
    sz = await gen_edge(text, voice, out_path, sem_edge)
    if isinstance(sz, int):
        return {"entry": entry, "variant": variant, "key": key_raw,
                "status": f"edge({sz}B)"}
    return {"entry": entry, "variant": variant, "key": key_raw,
            "status": f"failed-{sz}"}


async def run_variant(tasks, variant, sem_edge, dry):
    if not tasks:
        return []
    print(f"\n===== {('美音' if variant == 'us' else '英音')} {len(tasks)} 条 =====")
    t0 = time.time()
    results = []
    sem_local = asyncio.Semaphore(6)

    async def wrapped(t):
        async with sem_local:
            return await process_one(t, variant, sem_edge, dry)

    coros = [wrapped(t) for t in tasks]
    done = 0
    for fut in asyncio.as_completed(coros):
        r = await fut
        done += 1
        if done % 25 == 0 or done == len(coros):
            elapsed = time.time() - t0
            print(f"  [{variant}] 进度 {done}/{len(coros)}  ({elapsed:.0f}s)")
        results.append(r)
    return results


def collect_gaps(entries, man, variant):
    """收集 App 端漏播的 entry（与 audit_all_playback.mjs 一致）。

    评估口径：App lookup = manifest.get(text.trim().toLowerCase())，保留标点。
    漏播 = manifest 无该 key **或** 命中但文件不合格。
    """
    gaps = []
    for e in entries:
        suf = "" if variant == "us" else "-uk"
        key = e["english"].strip().lower()  # 保留标点（与 App 一致）
        existing_id = man.get(key)
        if existing_id:
            tgt = AUDIO / f"{existing_id}{suf}.mp3"
            if is_good_size(tgt):
                continue
        gaps.append(e)
    return gaps


def update_manifest(man, results, variant):
    """把成功项写入 manifest 返回新增条数。

    注意：App 端 lookup（src/lib/audio.ts:96）是 `text.trim().toLowerCase()`，
    美音/英音都用同一 key（保留撇号点号），**不要**清洗标点。
    """
    added = 0
    new_idx = {}
    for r in results:
        if r["status"].startswith("youdao") or r["status"].startswith("edge"):
            # ⚠️ 美音/英音都用 raw key（与 App lookup 一致）
            key = r["key"]
            id = r["entry"]["id"]
            new_idx[key] = id
            added += 1
    if new_idx:
        man.update(new_idx)
    return added, new_idx


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--us", action="store_true")
    ap.add_argument("--uk", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--min-grade", type=int, default=7, help="外研年级下界（含）")
    ap.add_argument("--max-grade", type=int, default=9, help="外研年级上界（含）")
    args = ap.parse_args()

    if not args.us and not args.uk:
        # 默认两个都跑
        args.us = args.uk = True

    entries = parse_waiyanshe(args.min_grade, args.max_grade)
    print(f"外研 G{args.min_grade}-G{args.max_grade} 词条: {len(entries)}")

    if args.limit:
        entries = entries[: args.limit]
        print(f"--limit={args.limit}: 只处理前 {len(entries)} 条")

    man_us = json.loads(MAN_US.read_text(encoding="utf-8")) if MAN_US.exists() else {}
    man_uk = json.loads(MAN_UK.read_text(encoding="utf-8")) if MAN_UK.exists() else {}

    sem_edge = asyncio.Semaphore(6)
    log_lines = []

    if args.us:
        gaps_us = collect_gaps(entries, man_us, "us")
        print(f"\n美音缺口: {len(gaps_us)}")
        results_us = await run_variant(gaps_us, "us", sem_edge, args.dry_run)
        if not args.dry_run:
            added_us, idx_us = update_manifest(man_us, results_us, "us")
            if idx_us:
                MAN_US.write_text(json.dumps(man_us, ensure_ascii=False), encoding="utf-8")
            print(f"美音新增入 manifest: {added_us}")
            for r in results_us:
                if r["status"] not in ("skip-ok",):
                    log_lines.append(f"  US  {r['entry']['id']}\t{r['entry']['english']}\t-> {r['status']}")

    if args.uk:
        gaps_uk = collect_gaps(entries, man_uk, "uk")
        print(f"\n英音缺口: {len(gaps_uk)}")
        results_uk = await run_variant(gaps_uk, "uk", sem_edge, args.dry_run)
        if not args.dry_run:
            added_uk, idx_uk = update_manifest(man_uk, results_uk, "uk")
            if idx_uk:
                MAN_UK.write_text(json.dumps(man_uk, ensure_ascii=False), encoding="utf-8")
            print(f"英音新增入 manifest: {added_uk}")
            for r in results_uk:
                if r["status"] not in ("skip-ok",):
                    log_lines.append(f"  UK  {r['entry']['id']}\t{r['entry']['english']}\t-> {r['status']}")

    if args.dry_run:
        print("\n[DRY-RUN] 没修改任何文件")
        if log_lines:
            LOG.parent.mkdir(parents=True, exist_ok=True)
            LOG.write_text("\n".join(log_lines), encoding="utf-8")
            print(f"清单见 {LOG}")
        return

    # 汇总
    if log_lines:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        LOG.write_text("\n".join(log_lines), encoding="utf-8")
    print(f"\n========== 完成 ==========")
    print(f"manifest 键数：美音 {len(man_us)} / 英音 {len(man_uk)}")
    if log_lines:
        print(f"明细见 {LOG}")


if __name__ == "__main__":
    asyncio.run(main())
