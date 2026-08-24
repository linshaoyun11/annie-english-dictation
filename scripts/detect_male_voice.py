# -*- coding: utf-8 -*-
"""扫描 public/audio 全部 mp3，用基频(F0)识别男声文件。

原理：对每帧做自相关求基频，取"有声帧"的中位 F0。
男声典型 85~155Hz，女声典型 165~255Hz。低于 160Hz 判为疑似男声。

用法: python scripts/detect_male_voice.py [--threshold 160]
输出: scripts/male_voice_report.tsv  (文件名<TAB>中位F0<TAB>有声帧占比)
      终端打印疑似男声清单及词条文本
"""
import os
import sys
import json

import miniaudio
import numpy as np

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
US_MANIFEST = os.path.join(AUDIO_DIR, "manifest.json")
UK_MANIFEST = os.path.join(AUDIO_DIR, "manifest-uk.json")
THRESHOLD = 160.0

FRAME = 0.04   # 40ms
HOP = 0.01     # 10ms
FMIN, FMAX = 70.0, 400.0


def decode_mono(path):
    """解码 mp3 为 mono float32 [-1,1]，采样率降为 16kHz（足够测 F0）。"""
    with open(path, "rb") as f:
        raw = f.read()
    dec = miniaudio.decode(raw, sample_rate=16000, nchannels=1, output_format=miniaudio.SampleFormat.FLOAT32)
    samples = np.frombuffer(dec.samples, dtype=np.float32)
    return samples


def median_f0(samples, sr=16000):
    """自相关法逐帧测 F0，返回 (中位F0, 有声帧占比)。无声返回 (None, 0)。"""
    n = len(samples)
    if n < int(sr * 0.12):
        return None, 0.0
    frame_len = int(sr * FRAME)
    hop_len = int(sr * HOP)
    lag_min = int(sr / FMAX)
    lag_max = int(sr / FMIN)
    if lag_max >= frame_len:
        return None, 0.0

    # 全局能量参考
    all_rms = np.sqrt(np.convolve(samples**2, np.ones(hop_len) / hop_len, mode="same"))
    peak_rms = np.percentile(all_rms, 95)
    if peak_rms < 1e-4:
        return None, 0.0

    f0s = []
    total = 0
    for start in range(0, n - frame_len, hop_len):
        total += 1
        seg = samples[start:start + frame_len]
        rms = float(np.sqrt(np.mean(seg**2)))
        if rms < max(0.05 * peak_rms, 1e-4):
            continue  # 静音/极轻帧
        seg = seg - seg.mean()
        # 自相关（FFT 加速）
        size = 1
        while size < 2 * frame_len:
            size *= 2
        spec = np.fft.rfft(seg, size)
        ac = np.fft.irfft(spec * np.conj(spec), size)[:frame_len]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        seg_ac = ac[lag_min:lag_max + 1]
        peak_idx = int(np.argmax(seg_ac))
        peak_val = float(seg_ac[peak_idx])
        if peak_val < 0.45:
            continue  # 周期性不足（清音/噪声）
        lag = lag_min + peak_idx
        # 抛物线插值细化
        if 0 < peak_idx < len(seg_ac) - 1:
            y0, y1, y2 = seg_ac[peak_idx - 1], seg_ac[peak_idx], seg_ac[peak_idx + 1]
            denom = y0 - 2 * y1 + y2
            if abs(denom) > 1e-9:
                shift = 0.5 * (y0 - y2) / denom
                lag = lag_min + peak_idx + float(np.clip(shift, -0.5, 0.5))
        if lag > 0:
            f0s.append(sr / lag)

    if not f0s:
        return None, 0.0
    return float(np.median(f0s)), len(f0s) / max(total, 1)


def main():
    # id -> text 反查表（用两个 manifest 建 text->id 再反转）
    id2text = {}
    for mf in (US_MANIFEST, UK_MANIFEST):
        if os.path.exists(mf):
            with open(mf, encoding="utf-8") as f:
                m = json.load(f)
            for text, eid in m.items():
                id2text[eid] = text

    files = sorted(f for f in os.listdir(AUDIO_DIR) if f.endswith(".mp3"))
    print(f"共 {len(files)} 个 mp3，开始扫描…")

    rows = []
    suspected = []
    for i, fn in enumerate(files):
        path = os.path.join(AUDIO_DIR, fn)
        try:
            samples = decode_mono(path)
            f0, ratio = median_f0(samples)
        except Exception as e:
            rows.append((fn, None, None, f"ERR:{type(e).__name__}"))
            continue
        rows.append((fn, f0, ratio, ""))
        eid = fn[:-4]
        if f0 is not None and f0 < THRESHOLD and ratio >= 0.15:
            suspected.append((fn, f0, ratio, id2text.get(eid, "?")))

        if (i + 1) % 500 == 0:
            print(f"  进度 {i + 1}/{len(files)}，疑似男声 {len(suspected)}")

    out = os.path.join(os.path.dirname(__file__), "male_voice_report.tsv")
    with open(out, "w", encoding="utf-8") as f:
        f.write("file\tf0\tvoiced_ratio\tnote\n")
        for r in rows:
            f.write(f"{r[0]}\t{'' if r[1] is None else round(r[1], 1)}\t{'' if r[2] is None else round(r[2], 2)}\t{r[3]}\n")
    print(f"\n明细已写入 {out}")

    # 汇总 F0 分布
    valid = [r[1] for r in rows if r[1] is not None]
    if valid:
        v = np.array(valid)
        print(f"全部文件中位F0分布: p5={np.percentile(v,5):.0f} p25={np.percentile(v,25):.0f} "
              f"p50={np.percentile(v,50):.0f} p75={np.percentile(v,75):.0f} p95={np.percentile(v,95):.0f} Hz")

    print(f"\n===== 疑似男声（中位F0 < {THRESHOLD:.0f}Hz 且有声帧≥15%）: {len(suspected)} 个 =====")
    for fn, f0, ratio, text in suspected:
        print(f"  {fn}\t{f0:.0f}Hz\t{ratio:.0%}\t{text}")


if __name__ == "__main__":
    main()
