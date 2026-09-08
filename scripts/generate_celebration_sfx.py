# -*- coding: utf-8 -*-
"""
生成红白机(chiptune)风格的过关祝贺音效样本，供试听挑选。
纯标准库合成：方波/三角波 + 快速琶音 + 简单包络，模拟 NES 音源。
输出 44100Hz 16bit 单声道 WAV 到 .workbuddy/sfx-samples/
"""
import math
import os
import struct
import wave

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", ".workbuddy", "sfx-samples")
OUT_DIR = os.path.abspath(OUT_DIR)


def square(freq, dur, vol=0.28, duty=0.5):
    """方波（NES 主音色），duty=占空比，带轻微衰减包络"""
    n = int(SR * dur)
    out = []
    period = SR / freq
    for i in range(n):
        ph = (i % period) / period
        s = 1.0 if ph < duty else -1.0
        # 快起缓落包络，避免爆音
        t = i / n
        env = min(1.0, i / (0.004 * SR)) * (1.0 - 0.25 * t)
        out.append(s * vol * env)
    return out


def triangle(freq, dur, vol=0.3):
    """三角波（NES 低音声道），圆润"""
    n = int(SR * dur)
    out = []
    period = SR / freq
    for i in range(n):
        ph = (i % period) / period
        s = 4 * abs(ph - 0.5) - 1.0
        out.append(s * vol)
    return out


def silence(dur):
    return [0.0] * int(SR * dur)


def mix(*tracks):
    """把多轨混到一起（长度取最长）"""
    ln = max(len(t) for t in tracks)
    out = [0.0] * ln
    for t in tracks:
        for i, v in enumerate(t):
            out[i] += v
    m = max(1.0, max(abs(v) for v in out))
    return [v / m * 0.85 for v in out]


def concat(*parts):
    out = []
    for p in parts:
        out.extend(p)
    return out


def note_seq(notes, wavefn=square, note_dur=0.09, gap=0.0, vol=0.28):
    """notes: [(freq, dur_mult)] 或 [freq]"""
    out = []
    for nt in notes:
        if isinstance(nt, tuple):
            f, m = nt
        else:
            f, m = nt, 1.0
        out.extend(wavefn(f, note_dur * m, vol=vol))
        if gap > 0:
            out.extend(silence(gap))
    return out


# 音名频率
NOTE = {
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.0,
    'A4': 440.0, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99,
    'A5': 880.0, 'B5': 987.77,
    'C6': 1046.5, 'D6': 1174.66, 'E6': 1318.51, 'F6': 1396.91, 'G6': 1567.98,
    'A6': 1760.0, 'B6': 1975.53, 'C7': 2093.0,
    'GS4': 415.3, 'GS5': 830.61, 'AS4': 466.16, 'AS5': 932.33,
    'FS5': 739.99, 'DS5': 622.25,
}


def save(name, samples):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        data = b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples)
        w.writeframes(data)
    dur = len(samples) / SR
    print(f"{name}  {dur:.2f}s")


# ---------------------------------------------------------------
# 1. 马里奥 1-UP 风格：E5 G5 E6 C6 D6 G6，快速上行琶音，明亮雀跃
# ---------------------------------------------------------------
def sfx_1up():
    seq = ['E5', 'G5', 'E6', 'C6', 'D6', 'G6']
    return note_seq([NOTE[n] for n in seq], square, note_dur=0.085)


# ---------------------------------------------------------------
# 2. 90坦克吃道具风格：快速上行小琶音 + 结尾高音延长闪烁感
# ---------------------------------------------------------------
def sfx_tank_powerup():
    seq = [('C5', 1), ('E5', 1), ('G5', 1), ('C6', 1), ('E6', 1), ('G6', 2.2)]
    main = note_seq([(NOTE[n], m) for n, m in seq], square, note_dur=0.07)
    # 底层加一个快速滚动的三角波低音，更像 FC 道具音
    bass = note_seq([NOTE['C4'], NOTE['G4'], NOTE['C5']], triangle, note_dur=0.16, vol=0.22)
    return mix(main, bass)


# ---------------------------------------------------------------
# 3. 过关号角风格（马里奥关卡完成简化版）：
#    G C E G C E G(长) E，庄重又欢快
# ---------------------------------------------------------------
def sfx_level_complete():
    seq = [('G4', 1), ('C5', 1), ('E5', 1), ('G5', 1), ('C6', 1), ('E6', 1),
           ('G6', 3), ('E6', 2)]
    return note_seq([(NOTE[n], m) for n, m in seq], square, note_dur=0.11)


# ---------------------------------------------------------------
# 4. 金币"叮"风格：B5 -> E6 两音，极短清脆
# ---------------------------------------------------------------
def sfx_coin():
    a = square(NOTE['B5'], 0.08, vol=0.3)
    b = square(NOTE['E6'], 0.45, vol=0.3)
    return concat(a, b)


# ---------------------------------------------------------------
# 5. 萨尔达"拿到道具"风格：低-高-低-高高，先神秘后惊喜
# ---------------------------------------------------------------
def sfx_item_get():
    seq = [('G4', 1), ('FS5', 1), ('DS5', 1), ('A4', 1), ('GS4', 1),
           ('G4', 1), ('D5', 1), ('G5', 1), ('GS5', 1), ('B5', 1), ('C6', 2.5)]
    return note_seq([(NOTE[n], m) for n, m in seq], square, note_dur=0.09)


# ---------------------------------------------------------------
# 6. 连胜上升音（自创）：三次上行大跳，每跳升调，仪式感强
# ---------------------------------------------------------------
def sfx_fanfare_rise():
    part = lambda base: note_seq(
        [NOTE[base + '4'], NOTE[base + '5'], NOTE[base + '6']],
        square, note_dur=0.075)
    return concat(part('C'), silence(0.03), part('F'), silence(0.03), part('G'),
                  note_seq([('C', 1)], square, 0.0) if False else
                  square(NOTE['C6'], 0.5, vol=0.3))


if __name__ == "__main__":
    save("1-mario-1up-style.wav", sfx_1up())
    save("2-tank90-powerup-style.wav", sfx_tank_powerup())
    save("3-level-complete-fanfare.wav", sfx_level_complete())
    save("4-coin-ding.wav", sfx_coin())
    save("5-zelda-item-get-style.wav", sfx_item_get())
    save("6-fanfare-rise.wav", sfx_fanfare_rise())
    print("\nDONE ->", OUT_DIR)
