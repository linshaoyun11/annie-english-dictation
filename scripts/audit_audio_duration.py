#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频内容粗检：用「时长 vs 文本长度」的统计关系找出可疑错位。

思路：TTS 生成的 mp3，时长与文本字符数强正相关。
若某条 (text, id) 的时长严重偏离同长度文本的正常区间，
说明该 mp3 很可能录的是别的词 —— 即音频内容错位。

同时交叉检查同一 text 的 US / UK 两个音频时长是否相近。
"""
import json
import os
import struct
import statistics
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "public", "audio")

# ---------- MP3 时长解析（CBR 用首帧 bitrate 估算，VBR 用平均） ----------
BITRATES_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
BITRATES_V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
SAMPLE_RATES_V1 = [44100, 48000, 32000]
SAMPLE_RATES_V2 = [22050, 24000, 16000]
SAMPLE_RATES_V25 = [11025, 12000, 8000]


def mp3_duration(path):
    """返回 (seconds, bitrate_kbps) 或 (None, None)"""
    try:
        size = os.path.getsize(path)
        if size < 128:
            return None, None
        with open(path, "rb") as f:
            # 跳过 ID3v2
            head = f.read(10)
            offset = 0
            if head[:3] == b"ID3":
                tag_size = head[6] << 21 | head[7] << 14 | head[8] << 7 | head[9]
                offset = 10 + tag_size
                f.seek(offset)
            else:
                f.seek(0)
            data = f.read(4096)
            if len(data) < 4:
                return None, None
            # 找帧同步
            i = 0
            n = len(data)
            while i < n - 4:
                if data[i] == 0xFF and (data[i + 1] & 0xE0) == 0xE0:
                    b1, b2, b3 = data[i + 1], data[i + 2], data[i + 3]
                    ver_bits = (b1 >> 3) & 0x03
                    layer_bits = (b1 >> 1) & 0x03
                    br_index = (b2 >> 4) & 0x0F
                    sr_index = (b2 >> 2) & 0x03
                    if layer_bits == 0x01 and br_index not in (0, 15) and sr_index != 3:
                        if ver_bits == 0x03:  # MPEG1
                            br = BITRATES_V1L3[br_index]
                            sr = SAMPLE_RATES_V1[sr_index]
                        elif ver_bits == 0x02:  # MPEG2
                            br = BITRATES_V2L3[br_index]
                            sr = SAMPLE_RATES_V2[sr_index]
                        elif ver_bits == 0x00:  # MPEG2.5
                            br = BITRATES_V2L3[br_index]
                            sr = SAMPLE_RATES_V25[sr_index]
                        else:
                            i += 1
                            continue
                        if br == 0 or sr == 0:
                            i += 1
                            continue
                        # CBR 估算（Edge TTS 输出基本是 CBR）
                        dur = (size - offset) * 8 / (br * 1000)
                        return dur, br
                i += 1
            return None, None
    except Exception:
        return None, None


def load(name):
    with open(os.path.join(AUDIO, name), encoding="utf-8") as f:
        return json.load(f)


def analyze(manifest, label):
    rows = []
    missing = []
    for text, eid in manifest.items():
        p = os.path.join(AUDIO, f"{eid}.mp3")
        if not os.path.exists(p):
            missing.append((text, eid))
            continue
        dur, br = mp3_duration(p)
        if dur is None:
            missing.append((text, eid))
            continue
        rows.append((text, eid, dur, len(text)))
    print(f"\n=== {label} ===")
    print(f"manifest 条目: {len(manifest)}  可解析: {len(rows)}  缺失/无法解析: {len(missing)}")
    if missing[:10]:
        print("  缺失样例:", missing[:10])

    # 按字符长度分桶，统计每桶时长的中位数与四分位
    buckets = defaultdict(list)
    for text, eid, dur, ln in rows:
        buckets[ln].append(dur)

    med = {}
    for ln, durs in buckets.items():
        med[ln] = statistics.median(durs)

    # 用「相邻长度桶」平滑，避免长尾桶样本太少
    def expected(ln):
        vals = []
        for d in range(-3, 4):
            if ln + d in med and len(buckets[ln + d]) >= 5:
                vals.append(med[ln + d])
        if not vals:
            return med.get(ln, 1.0)
        return statistics.median(vals)

    # 找异常：时长 < 期望*0.45 或 > 期望*2.2，且绝对差 > 0.45s
    suspects = []
    for text, eid, dur, ln in rows:
        exp = expected(ln)
        if exp <= 0:
            continue
        ratio = dur / exp
        if (ratio < 0.45 or ratio > 2.2) and abs(dur - exp) > 0.45:
            suspects.append((text, eid, round(dur, 2), round(exp, 2), round(ratio, 2), ln))

    suspects.sort(key=lambda r: abs(r[4] - 1), reverse=True)
    print(f"可疑（时长严重偏离同长度文本中位）: {len(suspects)}")
    for s in suspects[:40]:
        print(f"  {s[0]!r:45s} id={s[1]:20s} dur={s[2]:6.2f}s exp={s[3]:6.2f}s ratio={s[4]:5.2f} len={s[5]}")
    return {t: d for t, _e, d, _l in rows}


us = load("manifest.json")
uk = load("manifest-uk.json")

us_dur = analyze(us, "US manifest")
uk_dur = analyze(uk, "UK manifest")

# 交叉检查：同一 text 的 US / UK 时长是否相近
print("\n=== US/UK 时长交叉检查 ===")
cross = []
for text in us:
    if text not in uk or text not in us_dur or text not in uk_dur:
        continue
    du, dk = us_dur[text], uk_dur[text]
    m = max(du, dk)
    if m > 0 and abs(du - dk) / m > 0.45 and abs(du - dk) > 0.5:
        cross.append((text, round(du, 2), round(dk, 2)))
cross.sort(key=lambda r: abs(r[1] - r[2]), reverse=True)
print(f"US/UK 时长差异过大: {len(cross)}")
for c in cross[:40]:
    print(f"  {c[0]!r:45s} us={c[1]:6.2f}s uk={c[2]:6.2f}s")
