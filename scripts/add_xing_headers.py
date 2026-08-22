"""
给 Edge TTS 生成的英音短语 mp3 补写 Info（Xing 兼容）头。

背景：edge-tts 输出的 mp3（MPEG2 Layer III 48kbps 24kHz）没有 Xing/Info
帧头，WebKit（iOS WKWebView/Safari）读不到时长，duration = Infinity。
后果：对这类文件执行 currentTime seek 会跳到接近结尾，循环重播时
只剩"短促尾音"；看门狗也拿不到真实时长。

做法：把第一个音频帧替换为一个等长的 Info 帧（头部参数与原帧一致，
载荷写入帧总数），文件总时长不变。补头后用帧解析器验证：
时长与补头前一致、帧数一致、头可被识别，验证不过则不写盘。
"""

import json
import pathlib
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "public" / "audio"
MANIFEST = ROOT / "public" / "audio" / "manifest.json"

BR_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
BR_V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 112, 128, 144, 160, 0, 0]
SR_V1 = [44100, 48000, 32000, 0]
SR_V2 = [22050, 24000, 16000, 0]


def parse_frames(data: bytes, start: int):
    """从 start 解析 mp3 帧。返回 (帧数, 总时长, 首帧信息或 None)。"""
    i = start
    frames = 0
    dur = 0.0
    first = None
    n = len(data)
    while i < n - 4:
        if data[i] == 0xFF and (data[i + 1] & 0xE0) == 0xE0:
            b1, b2, b3 = data[i + 1], data[i + 2], data[i + 3]
            version = (b1 >> 3) & 3
            layer = (b1 >> 1) & 3
            if layer != 1 or version in (0, 1):
                i += 1
                continue
            bri = (b2 >> 4) & 15
            sri = (b2 >> 2) & 3
            pad = (b2 >> 1) & 1
            ch_mode = (b3 >> 6) & 3
            if version == 3:  # MPEG1
                bitrate = BR_V1L3[bri] * 1000
                sr = SR_V1[sri]
                spf = 1152
                fl = 144 * bitrate // sr + pad
                side = 17 if ch_mode == 3 else 32
            else:  # MPEG2/2.5
                bitrate = BR_V2L3[bri] * 1000
                sr = SR_V2[sri]
                spf = 576
                fl = 72 * bitrate // sr + pad
                side = 9 if ch_mode == 3 else 17
            if bitrate == 0 or sr == 0:
                i += 1
                continue
            if first is None:
                first = (i, fl, side, spf, sr)
            frames += 1
            dur += spf / sr
            i += fl
        else:
            i += 1
    return frames, dur, first


def patch(path: pathlib.Path) -> str:
    data = path.read_bytes()
    prefix = b""
    start = 0
    if data[:3] == b"ID3":
        size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
        prefix = data[: 10 + size]
        start = 10 + size
    if b"Info" in data[start : start + 400] or b"Xing" in data[start : start + 400]:
        return "skip: header already present"

    frames, dur, first = parse_frames(data, start)
    if not first or frames == 0:
        return "FAIL: no audio frames found"
    fpos, fl, side, _spf, _sr = first
    frame1 = data[fpos : fpos + fl]

    # Info 帧：帧头复用原首帧头，side info 清零，载荷写 "Info"+flags+帧数
    info = bytearray(fl)
    info[0:4] = frame1[0:4]
    off = 4 + side
    info[off : off + 4] = b"Info"
    info[off + 4 : off + 8] = struct.pack(">I", 1)  # flags: 只有帧数字段
    info[off + 8 : off + 12] = struct.pack(">I", frames)
    new = prefix + bytes(info) + data[fpos + fl :]

    # 验证：头可识别、帧数一致、总时长一致
    if b"Info" not in new[len(prefix) : len(prefix) + 400]:
        return "FAIL: header not detectable after patch"
    f2, d2, _ = parse_frames(new, len(prefix))
    if f2 != frames or abs(d2 - dur) > 1e-6:
        return f"FAIL: validation mismatch ({f2}/{frames}, {d2:.3f}/{dur:.3f})"
    if len(new) != len(data):
        return "FAIL: size changed"

    path.write_bytes(new)
    return f"ok: {dur:.2f}s, {frames} frames"


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    phrases = [
        (t, i) for t, i in manifest.items() if " " in t.strip()
    ]
    print(f"phrases to patch: {len(phrases)}")
    fail = 0
    done = 0
    for text, eid in phrases:
        p = AUDIO_DIR / f"{eid}-uk.mp3"
        if not p.exists():
            print(f"MISSING {p.name} ({text!r})")
            fail += 1
            continue
        r = patch(p)
        if r.startswith("FAIL") or r == "MISSING":
            print(f"{r} {p.name} ({text!r})")
            fail += 1
        elif r.startswith("ok"):
            done += 1
    print(f"patched: {done}, skipped/unchanged: {len(phrases) - done - fail}, failed: {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
