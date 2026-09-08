# -*- coding: utf-8 -*-
"""
批量生成缺失音频（Edge TTS 神经语音）

背景：
  有道 dictvoice 对「需新合成的文本」一律 HTTP 500（只有词典已有录音能返回），
  新增 1592 条取不到 ⇒ 改用 Edge TTS。选它的关键理由：
  原生输出就是 48 kbps / 24000 Hz / 单声道，正是目标码率，零转码零损失。

语音：
  美音 en-US-AriaNeural
  英音 en-GB-SoniaNeural   ← 与 scripts/generate_audio_uk_edge.py 已有的
                             306 条英音短语同源，保持语料一致

输入：.workbuddy/tmp/audio-tasks.json（由 scripts/build_audio_tasks.mjs 生成）
输出：
  public/audio/{id}.mp3      美音
  public/audio/{id}-uk.mp3   英音
  public/audio/manifest.json / manifest-uk.json（增量合并）
  scripts/audio_edge_failed.log

特性：
  - 断点续传：已存在且校验通过的文件跳过
  - **魔数校验**：只接受 ID3 / MP3 帧头。⚠️ 这是修 305 个 WAV 伪装文件的教训 ——
    有道曾返回 RIFF/WAV 却带 Content-Type: audio/mpeg，旧脚本只校验长度 ≥1000
    就把 WAV 写进了 .mp3，白占 36.4 MB。这里必须卡死。
  - 失败指数退避重试；manifest 每 100 项落盘一次

用法：
  python scripts/generate_audio_edge.py                # 全量
  python scripts/generate_audio_edge.py --limit 20     # 先跑 20 条试水
  python scripts/generate_audio_edge.py --only us      # 只生成美音
"""
import asyncio
import json
import pathlib
import sys
import time

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
TASKS = ROOT / ".workbuddy" / "tmp" / "audio-tasks.json"
MANIFEST = AUDIO / "manifest.json"
MANIFEST_UK = AUDIO / "manifest-uk.json"
FAIL_LOG = ROOT / "scripts" / "audio_edge_failed.log"

VOICE_US = "en-US-AriaNeural"
VOICE_UK = "en-GB-SoniaNeural"
CONCURRENCY = 5
RETRIES = 4
MIN_SIZE = 1024

MP3_MAGIC = (b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"\xff\xfa", b"\xff\xe3")


def is_mp3(path: pathlib.Path) -> bool:
    """严格校验：体积够 + 魔数是 MP3。防止 WAV 伪装文件重现。"""
    try:
        if path.stat().st_size < MIN_SIZE:
            return False
        with path.open("rb") as f:
            head = f.read(3)
        return head.startswith(MP3_MAGIC)
    except OSError:
        return False


def load_json(path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print(f"⚠️ {path.name} 解析失败，改用空表")
    return default


async def gen_one(text: str, out: pathlib.Path, voice: str, sem: asyncio.Semaphore) -> bool:
    async with sem:
        for attempt in range(1, RETRIES + 1):
            try:
                # 直接写目标文件：save() 内部以 'wb' 打开并截断，
                # 不经过 tmp+move（沙箱会拦截 unlink）
                await edge_tts.Communicate(text, voice).save(str(out))
                if is_mp3(out):
                    return True
                # 写出来了但不是 MP3 —— 当作失败重试（Edge 正常不会触发）
                reason = f"非 MP3 格式（{out.stat().st_size if out.exists() else 0}B）"
            except Exception as e:  # noqa: BLE001
                reason = str(e)[:80]
            if attempt < RETRIES:
                await asyncio.sleep(1.5 * attempt)
            else:
                print(f"  FAIL {out.name} «{text[:40]}»: {reason}", flush=True)
                return False
        return False


async def main() -> int:
    args = sys.argv[1:]

    def opt(name, cast=str, default=None):
        if f"--{name}" in args:
            i = args.index(f"--{name}")
            return cast(args[i + 1]) if i + 1 < len(args) else default
        return default

    limit = opt("limit", int, 0)
    only = opt("only", str, "both")  # us / uk / both

    tasks = json.loads(TASKS.read_text(encoding="utf-8"))["tasks"]
    if limit:
        tasks = tasks[:limit]
    print(f"任务 {len(tasks)} 条 · 美音 {VOICE_US} · 英音 {VOICE_UK} · 并发 {CONCURRENCY}")

    manifest = load_json(MANIFEST, {})
    manifest_uk = load_json(MANIFEST_UK, {})
    print(f"现有 manifest：美音 {len(manifest)} 键 / 英音 {len(manifest_uk)} 键")

    AUDIO.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(CONCURRENCY)

    jobs = []  # (text, out_path, voice, kind, key)
    skipped = 0
    for t in tasks:
        key, text, tid = t["key"], t["text"], t["id"]
        if only in ("both", "us"):
            out = AUDIO / f"{tid}.mp3"
            if is_mp3(out):
                manifest.setdefault(key, tid)
                skipped += 1
            else:
                jobs.append((text, out, VOICE_US, "us", key, tid))
        if only in ("both", "uk"):
            out = AUDIO / f"{tid}-uk.mp3"
            if is_mp3(out):
                manifest_uk.setdefault(key, tid)
                skipped += 1
            else:
                jobs.append((text, out, VOICE_UK, "uk", key, tid))

    print(f"断点续传跳过 {skipped} 个；待生成 {len(jobs)} 个")

    t0 = time.time()
    done = 0
    ok = 0
    failed = []

    async def run(job):
        nonlocal done, ok
        text, out, voice, kind, key, tid = job
        good = await gen_one(text, out, voice, sem)
        done += 1
        if good:
            ok += 1
            (manifest if kind == "us" else manifest_uk)[key] = tid
        else:
            failed.append(f"{tid}\t{kind}\t{text}\t{voice}")
        if done % 100 == 0:
            el = time.time() - t0
            rate = done / el if el else 0
            eta = (len(jobs) - done) / rate if rate else 0
            # 每 100 项落盘一次，避免长跑中断丢进度
            MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            MANIFEST_UK.write_text(json.dumps(manifest_uk, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"  {done}/{len(jobs)}  成功 {ok}  失败 {len(failed)}  "
                  f"{rate:.1f} 个/秒  预计剩余 {eta / 60:.1f} 分钟", flush=True)
        await asyncio.sleep(0.05)

    await asyncio.gather(*(run(j) for j in jobs))

    # 最终落盘
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    MANIFEST_UK.write_text(json.dumps(manifest_uk, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if failed:
        FAIL_LOG.write_text("\n".join(failed) + "\n", encoding="utf-8")

    print("\n" + "=" * 60)
    print(f"完成  总 {len(jobs)}  成功 {ok}  失败 {len(failed)}  耗时 {(time.time() - t0) / 60:.1f} 分钟")
    print(f"manifest：美音 {len(manifest)} 键 / 英音 {len(manifest_uk)} 键")
    if failed:
        print(f"失败清单：{FAIL_LOG}")
        for f in failed[:15]:
            print("  " + f)
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
