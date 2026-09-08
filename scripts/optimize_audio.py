# -*- coding: utf-8 -*-
"""
存量音频优化：把超标文件重编码为 48 kbps / 24 kHz / 单声道

背景（2026-09-05 实测）：
  1. **305 个文件是 WAV 装进 .mp3 壳** —— 有道 dictvoice 偶尔返回 RIFF/WAV，
     但 Content-Type 仍写 `audio/mpeg`；旧脚本只校验 `buf.length >= 1000` 就把
     WAV 写进了 .mp3。浏览器靠内容嗅探仍能播，所以一直没被发现。
     这 305 个文件占 36.4 MB = 全库 34%，平均每个 120 KB（768 kbps 原始 PCM）。
  2. 其余真 MP3 里还有 704 个 >100 kbps 的（早期其他来源），占 21.2 MB。

实测转码质量（带限 100 Hz–11 kHz 的对数谱失真 LSD）：
  - 真 MP3 64k → 48k：LSD 1.37 dB，体积 ×0.77
  - WAV（768k）→ 48k：LSD 1.5–2.4 dB，体积 ×0.067
  - WAV → 64k：LSD 2.12 dB，体积 ×0.088（只比 48k 多占 0.8 MB，质量略好）
  判读：LSD < 1 dB 察觉不出；1–2 dB 很轻微。

方案（--scope）：
  wav    只修 305 个 WAV 伪装文件     106.6 → 72.7 MB（省 33.9 MB）零风险 ← 推荐
  high   wav + 704 个 >100k 真 MP3    106.6 → 55.2 MB（省 51.4 MB）
  all    全库统一 48k                 106.6 → 45.8 MB（省 60.8 MB）全库二次编码

用法：
  python scripts/optimize_audio.py --scope wav --dry-run   # 只看不动
  python scripts/optimize_audio.py --scope wav             # 实际执行
  python scripts/optimize_audio.py --scope wav --kbps 64   # WAV 转 64k

⚠️ 执行前建议先备份（git 里已有，可随时回滚）。
   脚本会先备份被改动的原文件到 .workbuddy/audio-backup/。
"""
import pathlib
import shutil
import subprocess
import sys
import wave
import tempfile

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
BACKUP = ROOT / ".workbuddy" / "audio-backup"

MP3_MAGIC = (b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"\xff\xfa", b"\xff\xe3")


def real_kind(path: pathlib.Path) -> str:
    with path.open("rb") as f:
        head = f.read(4)
    if head[:4] == b"RIFF":
        return "wav"
    if head[:3] == b"ID3" or head[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2",
                                          b"\xff\xfa", b"\xff\xe3"):
        return "mp3"
    return "unknown"


def mp3_kbps(path: pathlib.Path) -> float:
    """用首帧粗略取码率；解析失败返回 -1"""
    sys.path.insert(0, str(ROOT / ".workbuddy" / "tmp"))
    try:
        from probe_mp3 import parse
        r = parse(path)
        return r["kbps_avg"] if r else -1
    except Exception:  # noqa: BLE001
        return -1


def encode(src: pathlib.Path, dst: pathlib.Path, kbps: int, out_sr: int) -> None:
    """src → 48k/24k mono mp3。src 可能是 WAV 伪装的 .mp3，ffmpeg 能自动识别。"""
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
           "-codec:a", "libmp3lame", "-b:a", f"{kbps}k",
           "-ar", str(out_sr), "-ac", "1", "-map_metadata", "-1", str(dst)]
    subprocess.run(cmd, check=True)


def main() -> int:
    args = sys.argv[1:]

    def opt(name, cast=str, default=None):
        if f"--{name}" in args:
            i = args.index(f"--{name}")
            return cast(args[i + 1]) if i + 1 < len(args) else default
        return default

    scope = opt("scope", str, "wav")
    kbps = opt("kbps", int, 48)
    out_sr = opt("sr", int, 24000)
    dry = "--dry-run" in args

    files = sorted(AUDIO.glob("*.mp3"))
    targets = []
    for p in files:
        kind = real_kind(p)
        if kind == "wav":
            targets.append((p, "WAV伪装"))
        elif kind == "mp3" and scope in ("high", "all"):
            k = mp3_kbps(p)
            if scope == "all" and k > 56:
                targets.append((p, f"{k:.0f}k"))
            elif scope == "high" and k > 100:
                targets.append((p, f"{k:.0f}k"))

    if not targets:
        print("没有需要处理的文件")
        return 0

    old_total = sum(p.stat().st_size for p, _ in targets) / 1024 / 1024
    lib_total = sum(p.stat().st_size for p in AUDIO.glob("*.mp3")) / 1024 / 1024
    print(f"scope={scope}  目标 {len(targets)} 个文件  当前占用 {old_total:.1f} MB"
          f"（全库 {lib_total:.1f} MB）")
    print(f"转码参数：{kbps} kbps / {out_sr} Hz / mono")
    if dry:
        print("\n[dry-run] 前 15 个：")
        for p, tag in targets[:15]:
            print(f"  {p.name:<26}{tag:<10}{p.stat().st_size / 1024:>8.1f} KB")
        return 0

    BACKUP.mkdir(parents=True, exist_ok=True)
    new_total = 0
    old_seen = 0
    failed = []
    for i, (p, tag) in enumerate(targets, 1):
        bak = BACKUP / p.name
        if not bak.exists():
            shutil.copy2(p, bak)
        tmp = p.with_suffix(".opt.mp3")
        try:
            encode(p, tmp, kbps, out_sr)
            if not tmp.exists() or tmp.stat().st_size < 400:
                raise RuntimeError("输出过小")
            with tmp.open("rb") as f:
                if not f.read(3).startswith(MP3_MAGIC):
                    raise RuntimeError("输出不是 MP3")
            old, new = p.stat().st_size, tmp.stat().st_size
            tmp.replace(p)  # 沙箱允许 replace 覆盖
            new_total += new
            old_seen += old
            if i % 50 == 0:
                print(f"  {i}/{len(targets)}  已省 {(old_seen - new_total) / 1024 / 1024:.1f} MB",
                      flush=True)
        except Exception as e:  # noqa: BLE001
            tmp.unlink(missing_ok=True)
            failed.append(f"{p.name}\t{e}")
            print(f"  FAIL {p.name}: {e}", flush=True)

    lib_new = sum(p.stat().st_size for p in AUDIO.glob("*.mp3")) / 1024 / 1024
    print("\n" + "=" * 60)
    print(f"处理 {len(targets) - len(failed)}/{len(targets)}，失败 {len(failed)}")
    print(f"这批文件：{old_total:.1f} MB → {new_total / 1024 / 1024:.1f} MB"
          f"（省 {old_total - new_total / 1024 / 1024:.1f} MB）")
    print(f"全库 .mp3：{lib_total:.1f} MB → {lib_new:.1f} MB")
    print(f"原文件备份：{BACKUP}")
    if failed:
        print("\n失败：")
        for f in failed[:20]:
            print("  " + f)
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
