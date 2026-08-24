# -*- coding: utf-8 -*-
"""将基频偏低的词条音频统一替换为女声（Edge TTS）。

背景：有道 dictvoice 对部分词条返回男声人工录音/男声 TTS（中位 F0 < 150Hz，
而有道女声自然下限约 150Hz）。这些词条听起来突兀。

方案：
- 美音：en-US-AriaNeural（明亮标准美式女声）
- 英音：en-GB-SoniaNeural（与既有英音补全音色一致）
- 只处理 manifest.json / manifest-uk.json 实际引用的文件（其余为孤儿副本）
- 替换前自动备份到 scripts/male_voice_backup/

判定输入：scripts/male_voice_report.tsv（detect_male_voice.py 产出）

用法: python scripts/fix_male_voice.py [--threshold 150] [--dry-run]
"""
import asyncio
import csv
import json
import os
import shutil
import sys

import edge_tts

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, "..")
AUDIO_DIR = os.path.join(ROOT, "public", "audio")
REPORT = os.path.join(HERE, "male_voice_report.tsv")
BACKUP_DIR = os.path.join(HERE, "male_voice_backup")

US_VOICE = "en-US-AriaNeural"
UK_VOICE = "en-GB-SoniaNeural"
CONCURRENCY = 5

args = sys.argv[1:]
THRESHOLD = float(args[args.index("--threshold") + 1]) if "--threshold" in args else 150.0
DRY_RUN = "--dry-run" in args


def load_tasks():
    us_manifest = json.load(open(os.path.join(AUDIO_DIR, "manifest.json"), encoding="utf-8"))
    uk_manifest = json.load(open(os.path.join(AUDIO_DIR, "manifest-uk.json"), encoding="utf-8"))
    text_of = {}  # id -> text（美音清单优先，英音清单补漏）
    for text, eid in uk_manifest.items():
        text_of[eid] = text
    for text, eid in us_manifest.items():
        text_of[eid] = text  # 美音清单覆盖（同 id 时以美音文本为准）

    played_us = set(us_manifest.values())
    played_uk = set(uk_manifest.values())

    f0 = {}
    ratio = {}
    with open(REPORT, encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t"):
            if not row or row[0] == "file" or not row[1]:
                continue
            f0[row[0].removesuffix(".mp3")] = float(row[1])
            ratio[row[0].removesuffix(".mp3")] = float(row[2]) if row[2] else 0.0

    tasks = []
    for eid, v in f0.items():
        if v >= THRESHOLD:
            continue
        if eid.endswith("-uk"):
            base = eid[:-3]
            if base not in played_uk:
                continue
            tasks.append({"file": f"{eid}.mp3", "id": base, "text": text_of.get(base), "voice": UK_VOICE, "f0": v})
        else:
            if eid not in played_us:
                continue
            tasks.append({"file": f"{eid}.mp3", "id": eid, "text": text_of.get(eid), "voice": US_VOICE, "f0": v})
    # 过滤无效文本
    tasks = [t for t in tasks if t["text"]]
    return tasks


async def synth_one(text, voice, out_path):
    tmp = out_path + ".tmp.mp3"
    for attempt in range(3):
        try:
            tts = edge_tts.Communicate(text, voice=voice)
            await tts.save(tmp)
            if os.path.exists(tmp) and os.path.getsize(tmp) > 1000:
                os.replace(tmp, out_path)
                return True
        except Exception as e:
            print(f"  重试{attempt + 1} {text!r}: {type(e).__name__} {str(e)[:80]}")
            await asyncio.sleep(2 + attempt * 3)
    if os.path.exists(tmp):
        os.remove(tmp)
    return False


async def main():
    tasks = load_tasks()
    n_us = sum(1 for t in tasks if t["voice"] == US_VOICE)
    n_uk = len(tasks) - n_us
    print(f"阈值 {THRESHOLD:.0f}Hz：需替换 {len(tasks)} 个文件（美音 {n_us} / 英音 {n_uk}）")
    if DRY_RUN:
        for t in sorted(tasks, key=lambda x: x["f0"]):
            print(f"  {t['file']:28s} {t['f0']:5.0f}Hz  {t['voice']}  \"{t['text']}\"")
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)
    backed = set(os.listdir(BACKUP_DIR))

    sem = asyncio.Semaphore(CONCURRENCY)
    done = 0
    failed = []

    async def worker(t):
        nonlocal done
        async with sem:
            src = os.path.join(AUDIO_DIR, t["file"])
            dst = os.path.join(BACKUP_DIR, t["file"])
            if t["file"] not in backed and os.path.exists(src):
                shutil.copy2(src, dst)
                backed.add(t["file"])
            ok = await synth_one(t["text"], t["voice"], src)
            if not ok:
                failed.append(t)
        done += 1
        if done % 20 == 0:
            print(f"  进度 {done}/{len(tasks)}，失败 {len(failed)}")

    await asyncio.gather(*(worker(t) for t in tasks))
    print(f"\n完成：成功 {len(tasks) - len(failed)} / 失败 {len(failed)}")
    print(f"原文件备份于 {BACKUP_DIR}")
    if failed:
        with open(os.path.join(HERE, "fix_male_voice_failed.log"), "w", encoding="utf-8") as f:
            for t in failed:
                f.write(f"{t['file']}\t{t['text']}\t{t['voice']}\n")
        print("失败清单：scripts/fix_male_voice_failed.log")
        for t in failed[:20]:
            print(f"  {t['file']} {t['text']}")


if __name__ == "__main__":
    asyncio.run(main())
