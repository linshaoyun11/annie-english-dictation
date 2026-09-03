# -*- coding: utf-8 -*-
"""补全英音缺失项：用微软 Edge TTS（en-GB-SoniaNeural 英音女声）生成有道英音库没有的短语/句子。
用法: python scripts/fix_audio_uk.py [--voice en-GB-SoniaNeural]
"""
import asyncio
import json
import os
import sys

import edge_tts

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
US_MANIFEST = os.path.join(AUDIO_DIR, "manifest.json")
UK_MANIFEST = os.path.join(AUDIO_DIR, "manifest-uk.json")
VOICE = sys.argv[sys.argv.index("--voice") + 1] if "--voice" in sys.argv else "en-GB-SoniaNeural"
CONCURRENCY = 5


async def synth_one(text: str, out_path: str) -> bool:
    try:
        tts = edge_tts.Communicate(text, voice=VOICE)
        await tts.save(out_path)
        return os.path.exists(out_path) and os.path.getsize(out_path) > 1000
    except Exception as e:
        print(f"  FAIL {text!r}: {type(e).__name__} {str(e)[:120]}")
        return False


async def main() -> None:
    with open(US_MANIFEST, encoding="utf-8") as f:
        us = json.load(f)  # 文本 -> id
    with open(UK_MANIFEST, encoding="utf-8") as f:
        uk = json.load(f)

    missing = [t for t in us if t not in uk]
    print(f"缺失英音 {len(missing)} 条（现有 {len(uk)} / 目标 {len(us)}）")

    sem = asyncio.Semaphore(CONCURRENCY)

    async def worker(text: str) -> tuple[str, bool]:
        async with sem:
            entry_id = us[text]
            out = os.path.join(AUDIO_DIR, f"{entry_id}-uk.mp3")
            ok = await synth_one(text, out)
            if ok:
                uk[text] = entry_id
            return text, ok

    results = await asyncio.gather(*(worker(t) for t in missing))
    ok_count = sum(1 for _, ok in results if ok)
    fail = [t for t, ok in results if not ok]
    print(f"成功 {ok_count} / 失败 {len(fail)}")
    if fail:
        print("失败清单:", fail)

    # 与 manifest.json 保持同一格式：单行紧凑（等价 JS 的 JSON.stringify）。
    # 早期这里用 indent=0，会让每个键值对各占一行——内容等价但 git diff
    # 会凭空多出几千行，掩盖真正的改动。
    with open(UK_MANIFEST, "w", encoding="utf-8") as f:
        json.dump(uk, f, ensure_ascii=False, separators=(",", ":"))
    print(f"manifest-uk.json 更新为 {len(uk)} 键")


if __name__ == "__main__":
    asyncio.run(main())
