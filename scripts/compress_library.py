# -*- coding: utf-8 -*-
"""
全库音频二次压缩（带逐文件保真校验，不达标自动保留原文件）

背景：2026-09-10 实测新库 165.4 MB 全是音源原始字节（64-192 kbps / 48 kHz / 部分立体声），
没跑过 optimize_audio.py。抽样 80 条实测：
    32k → 59.5 MB（保真均值 0.9821，2 条 <0.90）
    48k → 88.1 MB（保真均值 0.9933，最低 0.9463，0 条 <0.90）  ← 默认
    64k → 116.7 MB（保真均值 0.9978）
48k/24kHz/mono 是 Edge TTS 的默认输出规格，对语音足够。

安全阀（三层）：
  1. 输出必须是合法 MP3 头且 >400 B
  2. 压缩后与原文件的 PCM 互相关 >= --min-corr（默认 0.90），否则保留原文件
  3. 压缩后体积 >= 原文件 ×0.95（省不了多少）也保留原文件，避免白损质量

回滚：git 里有压缩前的原始文件，`git checkout -- public/audio` 即可完整还原。

用法：
  python scripts/compress_library.py --dry-run            # 只抽样预览，不动文件
  python scripts/compress_library.py                       # 全库执行（约 20-50 分钟）
  python scripts/compress_library.py --limit 200           # 先跑 200 条看效果
  python scripts/compress_library.py --kbps 64             # 换档
"""
import argparse
import pathlib
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
TMP = ROOT / ".tmp-compress"

MP3_MAGIC = (b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"\xff\xfa", b"\xff\xe3")


def decode(path: pathlib.Path, sr: int = 24000) -> np.ndarray:
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-i", str(path),
           "-f", "s16le", "-ac", "1", "-ar", str(sr), "-"]
    out = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.int16).astype(np.float64)


def corr(a: np.ndarray, b: np.ndarray) -> float:
    """归一化互相关峰值（双向 lag 搜索）。

    ⚠️ 不要先 trim 去静音：trim 后两段起点可能差几十样本，而负 lag 落在
    循环卷积数组尾部，只搜 conv[:span] 会漏掉它，算出 0.25 这种假低分。
    """
    if a.size < 100 or b.size < 100:
        return 0.0
    span = a.size + b.size
    n = 1
    while n < span:
        n *= 2
    conv = np.fft.irfft(np.fft.rfft(a, n) * np.conj(np.fft.rfft(b, n)), n)
    peak = max(conv[:span].max(), conv[n - span:].max())
    na = np.sqrt((a * a).sum())
    nb = np.sqrt((b * b).sum())
    if na < 1e-9 or nb < 1e-9:
        return 0.0
    return float(np.clip(peak / (na * nb), 0.0, 1.0))


def encode(src: pathlib.Path, dst: pathlib.Path, kbps: int, sr: int) -> None:
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
           "-codec:a", "libmp3lame", "-b:a", f"{kbps}k",
           "-ar", str(sr), "-ac", "1", "-map_metadata", "-1", str(dst)]
    subprocess.run(cmd, check=True, capture_output=True)


def process(args) -> dict:
    p, kbps, sr, min_corr, keep_ratio, tmpdir = args
    old = p.stat().st_size
    tmp = tmpdir / f"{p.stem}.c.mp3"
    try:
        encode(p, tmp, kbps, sr)
        new = tmp.stat().st_size
        with tmp.open("rb") as f:
            if not f.read(3).startswith(MP3_MAGIC):
                return {"name": p.name, "act": "skip", "why": "输出非MP3", "old": old, "new": old}
        if new < 400:
            return {"name": p.name, "act": "skip", "why": "输出过小", "old": old, "new": old}
        c = corr(decode(p), decode(tmp))
        if c < min_corr:
            return {"name": p.name, "act": "skip", "why": f"保真{c:.3f}<{min_corr}",
                    "old": old, "new": old}
        if new >= old * keep_ratio:
            return {"name": p.name, "act": "skip", "why": f"省不下({new/old:.2f})",
                    "old": old, "new": old}
        tmp.replace(p)  # 沙箱允许 replace 覆盖
        return {"name": p.name, "act": "ok", "why": f"{c:.4f}", "old": old, "new": new}
    except Exception as e:  # noqa: BLE001
        return {"name": p.name, "act": "fail", "why": str(e)[:60], "old": old, "new": old}
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kbps", type=int, default=48)
    ap.add_argument("--sr", type=int, default=24000)
    ap.add_argument("--min-corr", type=float, default=0.90)
    ap.add_argument("--keep-ratio", type=float, default=0.95,
                    help="压缩后 >= 原大小×该值则保留原文件")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--concurrency", type=int, default=8)
    ap.add_argument("--dry-run", action="store_true", help="只跑前 30 条预览，不落盘")
    a = ap.parse_args()

    files = sorted(AUDIO.glob("*.mp3"))
    if a.limit:
        files = files[: a.limit]
    if a.dry_run:
        files = files[:30]

    before = sum(p.stat().st_size for p in AUDIO.glob("*.mp3"))
    print(f"目标 {len(files)} 个文件  全库 {before/1024/1024:.1f} MB  "
          f"参数 {a.kbps}k/{a.sr}Hz/mono  min_corr={a.min_corr}")
    if a.dry_run:
        print("[dry-run] 只解码统计，不写回文件")

    if TMP.exists():
        shutil.rmtree(TMP, ignore_errors=True)
    TMP.mkdir(parents=True, exist_ok=True)

    tasks = [(p, a.kbps, a.sr, a.min_corr, a.keep_ratio, TMP) for p in files]
    results = []
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=a.concurrency) as ex:
        for i, r in enumerate(ex.map(process, tasks), 1):
            results.append(r)
            if i % 500 == 0:
                done_old = sum(x["old"] for x in results)
                done_new = sum(x["new"] for x in results)
                print(f"  {i}/{len(files)}  这批 {done_old/1024/1024:.1f} → "
                      f"{done_new/1024/1024:.1f} MB", flush=True)
    dt = time.time() - t0

    ok = [r for r in results if r["act"] == "ok"]
    skip = [r for r in results if r["act"] == "skip"]
    fail = [r for r in results if r["act"] == "fail"]
    after = sum(p.stat().st_size for p in AUDIO.glob("*.mp3"))

    print("\n" + "=" * 62)
    print(f"压缩 {len(ok)}   跳过 {len(skip)}   失败 {len(fail)}   耗时 {dt/60:.1f} 分钟")
    if not a.dry_run:
        print(f"全库 {before/1024/1024:.1f} MB → {after/1024/1024:.1f} MB  "
              f"（省 {(before-after)/1024/1024:.1f} MB，×{after/before:.3f}）")
    if skip:
        why = {}
        for r in skip:
            key = r["why"].split("(")[0].split("<")[0][:14]
            why[key] = why.get(key, 0) + 1
        print(f"跳过原因：{why}")
    if fail:
        print("失败：")
        for r in fail[:10]:
            print(f"  {r['name']}  {r['why']}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
