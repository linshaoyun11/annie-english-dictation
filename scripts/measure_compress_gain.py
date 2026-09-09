# -*- coding: utf-8 -*-
"""
评估对新音频库做二次压缩的收益与代价（只读 + 临时目录，不碰 public/audio）

抽样 N 个文件，在 .tmp-compress/ 下转码到指定 kbps，统计：
  - 压缩比（按体积加权，比"平均压缩比"准）
  - 预计全库体积
  - PCM 互相关：压缩后 vs 原文件，确认内容/发音未变
  - 耗时

用法：
  python scripts/measure_compress_gain.py --n 60 --kbps 48
  python scripts/measure_compress_gain.py --n 60 --kbps 64 --sr 24000
"""
import argparse
import pathlib
import random
import shutil
import subprocess
import sys
import time

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
TMP = ROOT / ".tmp-compress"


def decode(path: pathlib.Path, sr: int = 24000):
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-i", str(path),
           "-f", "s16le", "-ac", "1", "-ar", str(sr), "-"]
    out = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.int16).astype(np.float64)


def corr(a: np.ndarray, b: np.ndarray) -> float:
    """归一化互相关峰值（双向 lag 搜索）。

    ⚠️ 不要先 trim 去静音：trim 后两段的起点可能差几十样本，
    而下面只取 conv 的前 (a+b) 个就只搜了 lag>=0；负 lag 落在数组尾部，
    搜不到就会算出 0.25 这种假的低分（实测不去静音是 0.99）。
    转码前后样本数本来就一致，直接全信号比对即可。
    """
    if a.size < 100 or b.size < 100:
        return 0.0
    span = a.size + b.size
    n = 1
    while n < span:
        n *= 2
    conv = np.fft.irfft(np.fft.rfft(a, n) * np.conj(np.fft.rfft(b, n)), n)
    pos = conv[:span].max()          # lag >= 0
    neg = conv[n - span:].max()      # lag < 0（循环卷积的尾部）
    na = np.sqrt((a * a).sum())
    nb = np.sqrt((b * b).sum())
    if na < 1e-9 or nb < 1e-9:
        return 0.0
    return float(np.clip(max(pos, neg) / (na * nb), 0.0, 1.0))


def encode(src: pathlib.Path, dst: pathlib.Path, kbps: int, sr: int) -> None:
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
           "-codec:a", "libmp3lame", "-b:a", f"{kbps}k",
           "-ar", str(sr), "-ac", "1", "-map_metadata", "-1", str(dst)]
    subprocess.run(cmd, check=True, capture_output=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=60)
    ap.add_argument("--kbps", type=int, default=48)
    ap.add_argument("--sr", type=int, default=24000)
    ap.add_argument("--seed", type=int, default=11)
    a = ap.parse_args()

    files = sorted(AUDIO.glob("*.mp3"))
    rnd = random.Random(a.seed)
    sample = rnd.sample(files, min(a.n, len(files)))

    if TMP.exists():
        shutil.rmtree(TMP, ignore_errors=True)
    TMP.mkdir(parents=True, exist_ok=True)

    old_b = new_b = 0
    worst = []
    t0 = time.time()
    for i, p in enumerate(sample, 1):
        dst = TMP / f"{i:04d}.mp3"
        encode(p, dst, a.kbps, a.sr)
        o, n = p.stat().st_size, dst.stat().st_size
        old_b += o
        new_b += n
        c = corr(decode(p), decode(dst))
        worst.append((c, p.name, o, n))
        if i % 10 == 0:
            print(f"  {i}/{len(sample)}", flush=True)
    dt = time.time() - t0

    ratio = new_b / old_b if old_b else 0
    lib_old = sum(p.stat().st_size for p in files) / 1024 / 1024
    per_file = dt / len(sample)

    print("\n" + "=" * 62)
    print(f"参数        : {a.kbps} kbps / {a.sr} Hz / mono")
    print(f"样本        : {len(sample)} 个")
    print(f"体积        : {old_b/1024/1024:.2f} MB → {new_b/1024/1024:.2f} MB  （×{ratio:.3f}）")
    print(f"预计全库    : {lib_old:.1f} MB → {lib_old*ratio:.1f} MB  （省 {lib_old*(1-ratio):.1f} MB）")
    print(f"耗时        : {dt:.1f}s（{per_file:.2f}s/个）→ 全库约 {per_file*len(files)/60:.0f} 分钟")

    worst.sort()
    print(f"\n内容保真（压缩后 vs 原文件的 PCM 互相关，1.0 = 完全一致）：")
    cs = [w[0] for w in worst]
    print(f"  最低 {min(cs):.4f}   中位 {sorted(cs)[len(cs)//2]:.4f}   平均 {sum(cs)/len(cs):.4f}")
    print("  最差 5 条：")
    for c, name, o, n in worst[:5]:
        print(f"    {c:.4f}  {name}  {o/1024:.1f}KB → {n/1024:.1f}KB")
    bad = [w for w in worst if w[0] < 0.90]
    print(f"  <0.90 的条数：{len(bad)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
