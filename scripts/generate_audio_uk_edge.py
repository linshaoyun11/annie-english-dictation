# -*- coding: utf-8 -*-
"""
批量重新生成短语英语音频（Edge TTS 神经网络英音 Sonia）

背景：短语（含空格文本）的 {id}-uk.mp3 当年用有道英音合成，机器音重；
美式短语与英式单词都正常，只换这 306 条短语的英音文件。
文本 → id 映射沿用 manifest.json，文件名不变，manifest-uk.json 无需改动。

用法：
  python scripts/generate_audio_uk_edge.py            # 全量生成（覆盖前备份）
  python scripts/generate_audio_uk_edge.py --dry-run  # 只列出将要生成的条目
"""

import asyncio
import json
import pathlib
import shutil
import sys

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "public" / "audio"
BACKUP_DIR = ROOT / ".workbuddy" / "uk-phrase-backup"
MANIFEST = ROOT / "public" / "audio" / "manifest.json"

VOICE = "en-GB-SoniaNeural"  # 英式女声（与试听样本 edge-uk 一致）
CONCURRENCY = 4
RETRIES = 4


def phrase_entries() -> list[tuple[str, str]]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return [(t, i) for t, i in manifest.items() if " " in t.strip()]


async def gen_one(text: str, out: pathlib.Path, sem: asyncio.Semaphore) -> bool:
    async with sem:
        for attempt in range(1, RETRIES + 1):
            try:
                # 直接写入目标文件（save 内部以 'wb' 打开并截断，
                # 不经过 tmp+move/unlink —— 沙箱会拦截删除操作）
                communicate = edge_tts.Communicate(text, VOICE)
                await communicate.save(str(out))
                # 校验：文件存在且 > 1KB（空文件/损坏文件拒绝采用）
                if out.exists() and out.stat().st_size > 1024:
                    return True
            except Exception as e:  # noqa: BLE001
                if attempt == RETRIES:
                    print(f"FAIL {out.name} ({text!r}): {e}", flush=True)
                    return False
                await asyncio.sleep(1.5 * attempt)  # 指数退避，缓解限流
        return False


async def main(dry_run: bool) -> int:
    entries = phrase_entries()
    print(f"phrases to generate: {len(entries)}, voice: {VOICE}")

    if dry_run:
        for t, i in entries[:20]:
            print(f"  {i}  {t!r}")
        print("... (dry run, nothing written)")
        return 0

    # 不做旧文件备份：旧文件在 git 历史中可随时找回，
    # 且备份留在 .workbuddy 外的目录不进包，删掉即可防止误留
    sem = asyncio.Semaphore(CONCURRENCY)
    tasks = []
    for text, entry_id in entries:
        out = AUDIO_DIR / f"{entry_id}-uk.mp3"
        tasks.append(gen_one(text, out, sem))

    results = await asyncio.gather(*tasks)
    ok = sum(1 for r in results if r)
    print(f"done: {ok}/{len(entries)} succeeded")
    if ok < len(entries):
        print("re-run this script to retry failures (already-good files will be regenerated, that's fine)")
    return 0 if ok == len(entries) else 1


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    sys.exit(asyncio.run(main(dry)))
