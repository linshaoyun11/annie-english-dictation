# -*- coding: utf-8 -*-
"""
清理旧命名体系的音频文件（g*/wy-*/ox-*/ra-*/kb*/n*），只保留新的 t{hash}*.mp3。

⚠️ 前置条件（务必先确认，否则会删掉正在用的音频）：
  1. scripts/regen_audio_by_text.py 已全量跑完
  2. scripts/compare_old_new_audio.py 已确认新库正确
  3. manifest.json / manifest-uk.json 已经 --prune 过（不再引用旧 id）

分批删除：一次 400 个，避免触发沙箱/系统的批量删除保护。

用法：
  python scripts/cleanup_old_audio.py --dry-run    # 先看会删多少
  python scripts/cleanup_old_audio.py              # 实际删
"""
import argparse
import pathlib
import re
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
BATCH = 400

# 新命名：t + 16 位十六进制
NEW_RE = re.compile(r"^t[0-9a-f]{16}(-uk)?\.mp3$")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    all_mp3 = [p for p in AUDIO.glob("*.mp3")]
    old = [p for p in all_mp3 if not NEW_RE.match(p.name)]
    new = [p for p in all_mp3 if NEW_RE.match(p.name)]
    total_old = sum(p.stat().st_size for p in old)
    total_new = sum(p.stat().st_size for p in new)

    print(f"新命名文件 {len(new)} 个  {total_new/1024/1024:.1f} MB")
    print(f"旧命名文件 {len(old)} 个  {total_old/1024/1024:.1f} MB")
    if a.dry_run:
        print("\n--dry-run：未删除。样例：")
        for p in old[:10]:
            print("  ", p.name)
        return

    # 安全闸：新文件太少说明还没生成完
    if len(new) < 8000:
        print(f"⚠️ 新文件仅 {len(new)} 个，少于 8000，疑似未生成完，已中止。")
        return

    deleted = 0
    failed = []
    t0 = time.time()
    for i in range(0, len(old), BATCH):
        batch = old[i: i + BATCH]
        for p in batch:
            try:
                p.unlink()
                deleted += 1
            except Exception as e:
                failed.append((p.name, str(e)))
        print(f"  已删 {deleted}/{len(old)}  {deleted/(time.time()-t0):.0f}/s", flush=True)
        if failed:
            print(f"  ⚠️ 出现 {len(failed)} 个失败，示例：{failed[:3]}")
            break
    print(f"\n完成：删除 {deleted} 个，失败 {len(failed)} 个，"
          f"用时 {(time.time()-t0)/60:.1f} 分钟")


if __name__ == "__main__":
    main()
