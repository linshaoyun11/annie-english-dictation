# -*- coding: utf-8 -*-
"""
新音频全量「字节级」核查 —— 6 条线 × 美音/英音 = 12 组，逐条验证文件里念的是什么。

为什么可以字节比对：
  存量文件是生成时的**原始字节**（未做过二次转码），而两个音源都是确定性的：
    · 有道 dictvoice：同文本两次下载字节完全一致（实测 9206 vs 9206）
    · Edge TTS：同文本两次合成 md5 完全一致
  ⇒ 只要「重新取一次音源」的字节 == 磁盘文件字节，就能 100% 断定文件内容正确，
    比 PCM 互相关（阈值 0.90）严格得多，而且快得多（不用 ffmpeg 解码）。

⚠️ 必须用 raw 原始大小写 + 生成时同一套 sanitize：
   有道对 ben / Ben 返回不同录音（9206 vs 8640 字节）。
   这里直接 import regen 脚本的 sanitize/fname，杜绝逻辑走样。

用法：
  python scripts/verify_full_bytes.py --limit 100        # 试跑
  python scripts/verify_full_bytes.py                    # 全量 9730 条
"""
import argparse
import asyncio
import json
import pathlib
import sys
import time
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import regen_audio_by_text as R  # noqa: E402  （复用 sanitize / fname / youdao，保证一致）

AUDIO = R.AUDIO
BY_LINE = ROOT / ".workbuddy" / "tmp" / "texts-by-line.json"


def youdao_bytes(text: str, accent: str) -> bytes | None:
    url = ("https://dict.youdao.com/dictvoice?audio=" + R.urllib.parse.quote(text)
           + f"&type={R.YD_TYPE[accent]}")
    req = R.urllib.request.Request(url, headers={"User-Agent": R.UA})
    try:
        with R.urllib.request.urlopen(req, timeout=25) as r:
            data = r.read()
    except Exception:
        return None
    if not (R.MIN_BYTES <= len(data) <= R.MAX_BYTES):
        return None  # 生成时也会拒掉这个区间，等同"有道不可用"
    return data


async def edge_bytes(text: str, accent: str, sem: asyncio.Semaphore, tmp: pathlib.Path):
    import edge_tts
    p = tmp / f"v{abs(hash((text, accent))) % 10**12}.mp3"
    async with sem:
        try:
            await edge_tts.Communicate(text, R.VOICE[accent]).save(str(p))
            return p.read_bytes()
        except Exception:
            return None


async def check(item, accent, sem, tmp):
    text, h = item
    f = AUDIO / f"{h}{'-uk' if accent == 'uk' else ''}.mp3"
    if not f.exists():
        return (text, "missing_file", "")
    cur = f.read_bytes()
    raw = RAWS.get(text, text)
    tts = R.sanitize(raw)
    if not tts:
        return (text, "empty_text", "")

    yb = await asyncio.to_thread(youdao_bytes, tts, accent)
    if yb is not None and yb == cur:
        return (text, "youdao", "")
    eb = await edge_bytes(tts, accent, sem, tmp)
    if eb is not None and eb == cur:
        return (text, "edge", "")
    if yb is None and eb is None:
        return (text, "unverified", "两个音源都取不到")
    return (text, "MISMATCH", f"file={len(cur)}B youdao={len(yb) if yb else '-'}B edge={len(eb) if eb else '-'}B")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--concurrency", type=int, default=12)
    ap.add_argument("--out", default="scripts/full_verify.csv")
    a = ap.parse_args()

    global RAWS
    bl = json.loads(BY_LINE.read_text(encoding="utf-8"))
    RAWS = {k: v["raw"] for k, v in bl.items()}

    tmp = ROOT / ".tmp-vfb"
    tmp.mkdir(exist_ok=True)
    sem = asyncio.Semaphore(a.concurrency)

    all_rows = {}
    for accent in ("us", "uk"):
        mf = json.loads((AUDIO / ("manifest-uk.json" if accent == "uk" else "manifest.json")
                         ).read_text(encoding="utf-8"))
        items = list(mf.items())
        if a.limit:
            items = items[: a.limit]
        print(f"\n=== {accent.upper()} · {len(items)} 条 ===", flush=True)
        rows = []
        t0 = time.time()
        for i in range(0, len(items), a.concurrency):
            batch = items[i: i + a.concurrency]
            res = await asyncio.gather(*[check(it, accent, sem, tmp) for it in batch])
            rows.extend(res)
            el = time.time() - t0
            bad = sum(1 for r in res if r[1] == "MISMATCH")
            print(f"  {len(rows)}/{len(items)}  本批错位 {bad}  {len(rows)/el:.1f}/s", flush=True)
        all_rows[accent] = rows

    print(f"\n{'='*70}")
    print("全量字节级核查结果")
    print(f"{'='*70}")
    stat = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for accent, rows in all_rows.items():
        cnt = defaultdict(int)
        for _, st, _ in rows:
            cnt[st] += 1
        print(f"\n[{accent.upper()}] 合计 {len(rows)}")
        for k, v in sorted(cnt.items(), key=lambda x: -x[1]):
            print(f"   {k:14s} {v}")
        for text, st, _ in rows:
            info = bl.get(text)
            for ln in (info["lines"] if info else ["(未知)"]):
                stat[ln][accent][0] += 1
                if st == "MISMATCH":
                    stat[ln][accent][1] += 1

    print(f"\n按教材线 × 口音（错位/总数）：")
    print(f"  {'教材线':14s} {'美音':>14s} {'英音':>14s}")
    for ln in sorted(stat):
        us = stat[ln]["us"]; uk = stat[ln]["uk"]
        print(f"  {ln:14s} {us[1]:5d}/{us[0]:5d}   {uk[1]:5d}/{uk[0]:5d}")

    with open(a.out, "w", encoding="utf-8") as f:
        f.write("accent,text,status,detail\n")
        for accent, rows in all_rows.items():
            for text, st, det in rows:
                if st in ("MISMATCH", "unverified", "missing_file"):
                    f.write(f"{accent},{text},{st},{det}\n")
    print(f"\n问题明细已写出 {a.out}")


if __name__ == "__main__":
    asyncio.run(main())
