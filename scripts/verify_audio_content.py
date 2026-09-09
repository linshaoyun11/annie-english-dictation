# -*- coding: utf-8 -*-
"""
音频内容验证：判断 public/audio/{id}.mp3 里真正念的是哪个词。

⚠️ 关键教训（2026-09-09）：**必须双音源比对**
  存量音频混了两种音源：有道 dictvoice（64k/48kHz）与 Edge TTS（48k/24kHz）。
  实测「有道 name vs Edge name」相关度只有 0.20，「有道 vs Edge 同一词」基线普遍
  0.2~0.32 —— 单用 Edge 做参照会把「音源不同」误判成「词错」。
  ⇒ 候选必须同时用有道 + Edge 合成，取相关度最高值。

判据（已自检）：
  · 同一文件转码 48k/24kHz 后仍 0.9965，转码 32k 后 0.9896 ⇒ 对转码免疫
  · 正确匹配 ≈ 0.999；异词 < 0.35
  · 阈值：self >= 0.90 判为正确

用法：
  python scripts/verify_audio_content.py --file wy-g1u2e0020 --text name --cands name,point
  python scripts/verify_audio_content.py --probe 60                 # 随机抽样（双音源）
  python scripts/verify_audio_content.py --full --accent us         # 全量核查
  python scripts/verify_audio_content.py --full --accent us --by-line
"""
import argparse
import asyncio
import csv
import json
import pathlib
import random
import subprocess
import sys
import time
import urllib.parse
import urllib.request

import numpy as np
import imageio_ffmpeg
import edge_tts

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
SR = 24000
VOICE = {"us": "en-US-AriaNeural", "uk": "en-GB-SoniaNeural"}
YD_TYPE = {"us": 2, "uk": 1}
OK_THRESHOLD = 0.90
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def decode(path: pathlib.Path) -> np.ndarray:
    out = subprocess.run(
        [FF, "-v", "quiet", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True, check=True,
    )
    return np.frombuffer(out.stdout, dtype=np.float32)


def trim(x: np.ndarray, top_db: float = 0.02) -> np.ndarray:
    if x.size == 0:
        return x
    peak = float(np.max(np.abs(x)))
    if peak <= 0:
        return x
    idx = np.where(np.abs(x) > peak * top_db)[0]
    return x[idx[0]: idx[-1] + 1] if idx.size else x


def best_corr(a: np.ndarray, b: np.ndarray) -> float:
    if a.size == 0 or b.size == 0:
        return 0.0
    if a.size > b.size:
        a, b = b, a
    n = a.size
    if b.size < n:
        return 0.0
    a_n = a - a.mean()
    a_norm = float(np.sqrt(np.dot(a_n, a_n))) or 1.0
    maxshift = int(SR * 0.4)
    span = min(b.size - n, maxshift)
    step = max(1, span // 400)
    best = -1.0
    for s in range(0, span + 1, step):
        seg = b[s: s + n]
        seg_n = seg - seg.mean()
        denom = (float(np.sqrt(np.dot(seg_n, seg_n))) or 1.0) * a_norm
        c = float(np.dot(a_n, seg_n)) / denom
        if c > best:
            best = c
    return best


def youdao_sync(text: str, accent: str, out: pathlib.Path):
    url = ("https://dict.youdao.com/dictvoice?audio=" + urllib.parse.quote(text)
           + f"&type={YD_TYPE[accent]}")
    req = urllib.request.Request(url, headers=UA)
    data = urllib.request.urlopen(req, timeout=25).read()
    if len(data) < 1000:
        raise ValueError("too small")
    out.write_bytes(data)
    return out


async def synth_candidates(text: str, accent: str, tmp: pathlib.Path, sem: asyncio.Semaphore):
    """返回 [(来源, pcm)]，双音源。"""
    res = []
    tag = abs(hash((text, accent))) % (10 ** 12)

    async def edge_one():
        # ⚠️ 不要 unlink：沙箱 safe-delete 会拦截临时文件删除。save() 以 "wb" 覆盖写即可。
        p = tmp / f"e{tag}.mp3"
        async with sem:
            try:
                await edge_tts.Communicate(text, VOICE[accent]).save(str(p))
                return ("edge", trim(decode(p)))
            except Exception:
                return None

    def yd_one():
        p = tmp / f"y{tag}.mp3"
        try:
            youdao_sync(text, accent, p)
            return ("youdao", trim(decode(p)))
        except Exception:
            return None

    e_task = asyncio.create_task(edge_one())
    y_res = await asyncio.to_thread(yd_one)
    e_res = await e_task
    for r in (e_res, y_res):
        if r:
            res.append(r)
    return res


async def check_one(text, fid, accent, tmp, sem, tts_text=None):
    p = AUDIO / f"{fid}{'-uk' if accent == 'uk' else ''}.mp3"
    if not p.exists():
        return {"text": text, "id": fid, "status": "missing_file", "self": 0.0, "ctrl": 0.0}
    try:
        cur = trim(decode(p))
    except Exception as ex:
        return {"text": text, "id": fid, "status": f"decode_err:{ex}", "self": 0.0, "ctrl": 0.0}
    # ⚠️ 合成必须用「原始大小写」的 raw 文本：有道对 ben / Ben 返回的是不同录音，
    # 用小写 key 合成会造成大面积误判（2026-09-09 踩坑，误判率高达 35%）。
    cands = await synth_candidates(tts_text or text, accent, tmp, sem)
    if not cands:
        return {"text": text, "id": fid, "status": "synth_failed", "self": 0.0, "ctrl": 0.0}
    self_score = max(best_corr(cur, pcm) for _, pcm in cands)
    return {"text": text, "id": fid, "status": "ok" if self_score >= OK_THRESHOLD else "MISMATCH",
            "self": round(self_score, 4), "ctrl": 0.0}


async def run(items, accent, by_line=None, concurrency=16, label="", raws=None):
    tmp = ROOT / ".tmp-verifycache"
    tmp.mkdir(exist_ok=True)
    sem = asyncio.Semaphore(concurrency)
    out_rows = []
    t0 = time.time()
    done = 0
    total = len(items)
    for i in range(0, total, concurrency):
        batch = items[i: i + concurrency]
        rows = await asyncio.gather(*[
            check_one(t, f, accent, tmp, sem, (raws or {}).get(t)) for t, f in batch
        ])
        for r in rows:
            if by_line is not None:
                r["lines"] = "|".join(by_line.get(r["text"], []))
            out_rows.append(r)
        done += len(batch)
        bad = sum(1 for r in out_rows if r["status"] == "MISMATCH")
        el = time.time() - t0
        rate = done / el if el else 0
        eta = (total - done) / rate if rate else 0
        print(f"  {label} {done}/{total}  错位 {bad}  {rate:.1f}/s  剩余 {eta/60:.1f}min", flush=True)
    return out_rows


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text"); ap.add_argument("--file")
    ap.add_argument("--cands"); ap.add_argument("--accent", default="us")
    ap.add_argument("--probe", type=int)
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--by-line", action="store_true")
    ap.add_argument("--out", default=None)
    ap.add_argument("--concurrency", type=int, default=16)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--manifest", default=None, help="指定 manifest 路径（核查旧库时用备份）")
    a = ap.parse_args()
    tmp = ROOT / ".tmp-verifycache"; tmp.mkdir(exist_ok=True)

    if a.file:
        p = AUDIO / f"{a.file}{'-uk' if a.accent=='uk' else ''}.mp3"
        cur = trim(decode(p))
        print(f"{p.name}  {p.stat().st_size}B  {cur.size/SR:.3f}s")
        for c in (a.cands or a.text).split(","):
            for src, pcm in await synth_candidates(c, a.accent, tmp, asyncio.Semaphore(8)):
                print(f"   [{src:6s}] 「{c}」({pcm.size/SR:.3f}s) 相关 = {best_corr(cur, pcm):.4f}")
        return

    mf_path = pathlib.Path(a.manifest) if a.manifest else (
        AUDIO / ("manifest-uk.json" if a.accent == "uk" else "manifest.json"))
    mf = json.loads(mf_path.read_text(encoding="utf-8"))
    items = list(mf.items())
    by_line = None
    raws = {}
    bl = ROOT / ".workbuddy" / "tmp" / "texts-by-line.json"
    if bl.exists():
        bl_data = json.loads(bl.read_text(encoding="utf-8"))
        if a.by_line:
            by_line = {k: v["lines"] for k, v in bl_data.items()}
        raws = {k: v["raw"] for k, v in bl_data.items()}
    elif a.by_line:
        print("缺少 .workbuddy/tmp/texts-by-line.json，先跑 scripts/dump_texts_by_line.mjs")

    if a.probe:
        rng = random.Random(a.seed)
        items = rng.sample(items, min(a.probe, len(items)))
    rows = await run(items, a.accent, by_line, a.concurrency, label=f"[{a.accent}]", raws=raws)
    bad = [r for r in rows if r["status"] == "MISMATCH"]
    print(f"\n合计 {len(rows)} 条：正确 {len(rows)-len(bad)}  错位 {len(bad)}  其它 {sum(1 for r in rows if r['status'] not in ('ok','MISMATCH'))}")
    if a.by_line and by_line is not None:
        from collections import defaultdict
        stat = defaultdict(lambda: [0, 0])
        for r in rows:
            for ln in (r.get("lines") or "?").split("|"):
                stat[ln][0] += 1
                if r["status"] == "MISMATCH":
                    stat[ln][1] += 1
        print("\n按教材线统计：")
        for ln, (tot, b) in sorted(stat.items()):
            print(f"  {ln:14s} {b}/{tot} 错位  ({b/tot*100:.1f}%)")
    if a.out:
        with open(a.out, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["text", "id", "status", "self", "lines"])
            w.writeheader()
            for r in rows:
                w.writerow({k: r.get(k, "") for k in ["text", "id", "status", "self", "lines"]})
        print(f"明细已写出 {a.out}")
    if bad:
        print("\n错位样例（前 40）：")
        for r in bad[:40]:
            print(f"   {r['text'][:28]:30s} {r['id']:16s} self={r['self']}")


if __name__ == "__main__":
    asyncio.run(main())
