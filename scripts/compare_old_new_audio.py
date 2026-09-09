# -*- coding: utf-8 -*-
"""
「旧音频 vs 新音频」全量比对 —— 量化存量错位率。

思路：
  新音频（scripts/regen_audio_by_text.py 产出）是 100% 可信的基准
  （text 与 out_path 在同一函数内强绑定，不存在下标配对）。
  把旧文件与新文件逐条做 PCM 互相关：
    · 相关 ≥ 0.90 → 旧文件念的就是这个词（原本正确）
    · 相关 < 0.90 → 疑似错位，再用「有道 + Edge 双音源」复核一次
      （旧库混了两种音源，跨音源同词基线只有 0.2~0.3，必须双路取高分）

输出：
  · 总体正确/错位计数
  · 按 6 条教材线 × 美音/英音（12 组）分别统计
  · 错位明细 CSV

用法：
  python scripts/compare_old_new_audio.py
  python scripts/compare_old_new_audio.py --limit 200     # 先跑一部分
"""
import argparse
import asyncio
import csv
import json
import pathlib
import subprocess
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import imageio_ffmpeg

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from verify_audio_content import (  # noqa: E402
    AUDIO, SR, decode, trim, synth_candidates, best_corr,
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
OLD_US = ROOT / ".workbuddy" / "tmp" / "manifest-OLD-us.json"
OLD_UK = ROOT / ".workbuddy" / "tmp" / "manifest-OLD-uk.json"
BY_LINE = ROOT / ".workbuddy" / "tmp" / "texts-by-line.json"
SAME = 0.90

DS_SR = 8000  # 降采样到 8 kHz 做互相关，语音判别力足够且快很多


def fast_corr(a: np.ndarray, b: np.ndarray) -> float:
    """归一化滑动互相关最大值（FFT/卷积实现，比 Python 循环快两个数量级）。"""
    if a.size == 0 or b.size == 0:
        return 0.0
    if a.size > b.size:
        a, b = b, a
    n = a.size
    if b.size < n:
        return 0.0
    a = a - a.mean()
    na = float(np.sqrt(np.dot(a, a)))
    if na <= 0:
        return 0.0
    bf = b.astype(np.float64)
    c1 = np.concatenate(([0.0], np.cumsum(bf)))
    c2 = np.concatenate(([0.0], np.cumsum(bf * bf)))
    conv = np.convolve(bf, a[::-1], "valid")
    m = conv.size
    sb = c1[n: n + m] - c1[:m]
    sb2 = c2[n: n + m] - c2[:m]
    var = sb2 - sb * sb / n
    denom = na * np.sqrt(np.maximum(var, 0.0))
    corr = (conv - sb * a.sum() / n) / np.maximum(denom, 1e-9)
    # ⚠️ 数值稳定：窗口方差趋零（长音频里的静音段）会让归一化互相关爆炸到几十上百，
    # 导致「本不相同」被误判为相同（漏判）。这里把 RMS 过低的窗口直接作废。
    rms_win = np.sqrt(np.maximum(var, 0.0) / n)
    thr = 0.02 * (float(np.sqrt(np.dot(bf, bf) / b.size)) + 1e-12)
    corr = np.where(rms_win >= thr, corr, -1.0)
    return float(corr.max())


def to_pcm(path: pathlib.Path):
    try:
        x = trim(decode(path))
    except Exception:
        return None
    if x.size == 0:
        return None
    step = max(1, SR // DS_SR)
    return x[::step].astype(np.float32)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", choices=["us", "uk"], default=None)
    ap.add_argument("--out", default="scripts/old_vs_new.csv")
    ap.add_argument("--concurrency", type=int, default=12)
    a = ap.parse_args()

    old = {"us": load(OLD_US), "uk": load(OLD_UK)}
    new = {"us": load(AUDIO / "manifest.json"), "uk": load(AUDIO / "manifest-uk.json")}
    by_line = load(BY_LINE)

    rows = []
    for accent in ([a.only] if a.only else ("us", "uk")):
        for text, new_id in new[accent].items():
            old_id = old[accent].get(text)
            rows.append((accent, text, old_id, new_id))
    if a.limit:
        rows = rows[: a.limit]

    print(f"待比对 {len(rows)} 条")
    pool = ThreadPoolExecutor(max_workers=16)

    def prep(r):
        accent, text, old_id, new_id = r
        suf = "-uk" if accent == "uk" else ""
        np_ = AUDIO / f"{new_id}{suf}.mp3"
        op = AUDIO / f"{old_id}{suf}.mp3" if old_id else None
        return r, to_pcm(np_) if np_.exists() else None, to_pcm(op) if (op and op.exists()) else None

    t0 = time.time()
    results = []
    for i, (r, pnew, pold) in enumerate(pool.map(prep, rows, chunksize=16)):
        accent, text, old_id, new_id = r
        if pnew is None:
            results.append({**r2(accent, text, old_id, new_id), "status": "new_missing", "corr": 0.0})
            continue
        if pold is None:
            results.append({**r2(accent, text, old_id, new_id), "status": "old_missing", "corr": 0.0})
            continue
        c = fast_corr(pnew, pold)
        results.append({**r2(accent, text, old_id, new_id), "status": "same" if c >= SAME else "suspect", "corr": round(c, 4)})
        if (i + 1) % 500 == 0:
            el = time.time() - t0
            print(f"  {i+1}/{len(rows)}  {(i+1)/el:.0f}/s", flush=True)

    # 疑似项：双音源复核（旧库混有道/Edge，跨音源同词基线仅 0.2~0.3）
    suspects = [r for r in results if r["status"] == "suspect"]
    print(f"\n初步：相同 {sum(1 for r in results if r['status']=='same')}，"
          f"疑似 {len(suspects)}，旧缺失 {sum(1 for r in results if r['status']=='old_missing')}，"
          f"新缺失 {sum(1 for r in results if r['status']=='new_missing')}")
    if suspects:
        print(f"对 {len(suspects)} 条疑似项做双音源复核...")
        sem = asyncio.Semaphore(a.concurrency)
        tmp = ROOT / ".tmp-verifycache"
        tmp.mkdir(exist_ok=True)
        for i in range(0, len(suspects), a.concurrency):
            batch = suspects[i: i + a.concurrency]
            cands = await asyncio.gather(*[
                synth_candidates(s["text"], s["accent"], tmp, sem) for s in batch
            ])
            for s, cd in zip(batch, cands):
                if not cd:
                    s["status"] = "verify_failed"
                    continue
                pold = to_pcm(AUDIO / f"{s['old_id']}{'-uk' if s['accent']=='uk' else ''}.mp3")
                best = max((best_corr(pold, pcm) for _, pcm in cd), default=0.0)
                s["recheck"] = round(best, 4)
                s["status"] = "same_source_ok" if best >= SAME else "MISMATCH"
            print(f"  复核 {min(i+a.concurrency, len(suspects))}/{len(suspects)}", flush=True)

    bad = [r for r in results if r["status"] == "MISMATCH"]
    same = [r for r in results if r["status"] in ("same", "same_source_ok")]
    print(f"\n{'='*66}")
    print(f"最终：正确 {len(same)}   错位 {len(bad)}   "
          f"其它 {len(results)-len(same)-len(bad)}")
    print(f"{'='*66}")

    # 按 12 组统计
    stat = defaultdict(lambda: [0, 0])
    for r in results:
        info = by_line.get(r["text"])
        lines = info["lines"] if info else ["(孤儿文本)"]
        for ln in lines:
            k = f"{ln}/{r['accent']}"
            stat[k][0] += 1
            if r["status"] == "MISMATCH":
                stat[k][1] += 1
    print("\n按教材线 × 口音：")
    for k in sorted(stat):
        tot, b = stat[k]
        print(f"  {k:16s} {b:5d}/{tot:5d} 错位  ({b/tot*100:5.1f}%)")

    with open(a.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["accent", "text", "old_id", "new_id", "status", "corr", "recheck"])
        w.writeheader()
        for r in results:
            w.writerow({k: r.get(k, "") for k in w.fieldnames})
    print(f"\n明细已写出 {a.out}")


def r2(accent, text, old_id, new_id):
    return {"accent": accent, "text": text, "old_id": old_id, "new_id": new_id}


if __name__ == "__main__":
    asyncio.run(main())
