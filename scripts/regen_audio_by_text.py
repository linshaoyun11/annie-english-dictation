# -*- coding: utf-8 -*-
"""
按「文本」全量重生成音频 —— 彻底解耦 entry id，杜绝错位复发。

## 为什么必须重做（2026-09-09 事故）
  旧音频以 entry id 命名（wy-g1u2e0020.mp3），App 靠 manifest[text] -> id 找文件。
  实证：manifest['name'] = wy-g1u2e0020，但该文件念的是 **point**（有道音源，
  PCM 互相关 0.9994 vs 有道"point"，vs 有道"name" 仅 0.2749）。
  根因是「请求文本列表」与「保存文件名列表」错位，且 entry id 会随词库重建而位移，
  任何一次词表改动都会让存量音频整体错位 —— 这是结构性缺陷，不是偶发。

## 本脚本的防错设计
  1. **文件名 = blake2b(归一化文本) 的哈希**，与 entry id 完全无关。
     词表怎么改、顺序怎么变，音频文件名都不受影响。
  2. **一次调用内 text 与 out_path 强绑定**：`gen(key, raw) -> 写 hash(raw).mp3`。
     不存在"两个列表按下标配对"，从结构上不可能错位。
  3. App 端不自己算哈希，只查 manifest（本脚本同一次运行写出），零碰撞风险。

## 音源优先级（沿用 2026-09-07 约定）
  有道 dictvoice（美 type=2 / 英 type=1）优先；
  失败 / <1KB / >60KB（有道英音偶发 130KB 异常录音）→ Edge 兜底
  （美 en-US-AriaNeural / 英 en-GB-SoniaNeural）。

用法：
  python scripts/regen_audio_by_text.py --dry-run          # 只报数不下载
  python scripts/regen_audio_by_text.py --only us
  python scripts/regen_audio_by_text.py --limit 50         # 先跑 50 条试水
  python scripts/regen_audio_by_text.py                    # 全量
"""
import argparse
import asyncio
import hashlib
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
TEXTS = ROOT / ".workbuddy" / "tmp" / "texts-by-line.json"

VOICE = {"us": "en-US-AriaNeural", "uk": "en-GB-SoniaNeural"}
YD_TYPE = {"us": 2, "uk": 1}
MIN_BYTES = 1_000
MAX_BYTES = 60_000
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
MP3_MAGIC = (b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"\xff\xfa", b"\xff\xe3")


def fname(text: str) -> str:
    """文件名（不含扩展名）：归一化文本的 blake2b-64bit 哈希。"""
    norm = text.strip().lower()
    return "t" + hashlib.blake2b(norm.encode("utf-8"), digest_size=8).hexdigest()


def sanitize(text: str) -> str:
    """送给 TTS 的文本：* 标记与省略号念不出来，去掉。"""
    t = text.strip()
    while t.startswith("*"):
        t = t[1:]
    return t.replace("...", "").replace("…", "").strip()


def is_good(p: pathlib.Path) -> bool:
    try:
        if not p.exists() or not (MIN_BYTES <= p.stat().st_size <= MAX_BYTES):
            return False
        with p.open("rb") as f:
            return f.read(3).startswith(MP3_MAGIC)
    except OSError:
        return False


def youdao(text: str, accent: str, out: pathlib.Path):
    url = ("https://dict.youdao.com/dictvoice?audio=" + urllib.parse.quote(text)
           + f"&type={YD_TYPE[accent]}")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        data = r.read()
    if not (MIN_BYTES <= len(data) <= MAX_BYTES):
        raise ValueError(f"size {len(data)}")
    if not data[:3].startswith(MP3_MAGIC):
        raise ValueError("not mp3")
    out.write_bytes(data)
    return "youdao", len(data)


async def edge(text: str, accent: str, out: pathlib.Path, sem: asyncio.Semaphore):
    import edge_tts
    async with sem:
        await edge_tts.Communicate(text, VOICE[accent]).save(str(out))
    if not is_good(out):
        raise ValueError("edge bad output")
    return "edge", out.stat().st_size


async def gen_one(key, raw, accent, sem, stats):
    """⚠️ text 与 out_path 在本函数内强绑定，外部没有任何下标配对。"""
    import edge_tts  # noqa: F401
    h = fname(key)
    out = AUDIO / f"{h}{'-uk' if accent == 'uk' else ''}.mp3"
    if is_good(out):
        stats["skip"] += 1
        return
    tts_text = sanitize(raw)
    if not tts_text:
        stats["empty"] += 1
        return
    for attempt in range(3):
        try:
            src, size = await asyncio.to_thread(youdao, tts_text, accent, out)
            stats[src] += 1
            return
        except Exception as e:
            if attempt == 2:
                pass
            else:
                await asyncio.sleep(1.0 * (attempt + 1))
                continue
        # 有道失败 → Edge 兜底
        try:
            src, size = await edge(tts_text, accent, out, sem)
            stats[src] += 1
            return
        except Exception:
            await asyncio.sleep(1.5 * (attempt + 1))
    stats["fail"] += 1
    stats["failed_list"].append((key, raw, accent))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["us", "uk"], default=None)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--prune", action="store_true",
                    help="manifest 只保留当前词表的键（全量跑完后再用，清理孤儿键）")
    ap.add_argument("--concurrency", type=int, default=12)
    a = ap.parse_args()

    data = json.loads(TEXTS.read_text(encoding="utf-8"))
    items = list(data.items())
    if a.limit:
        items = items[: a.limit]
    accents = [a.only] if a.only else ["us", "uk"]

    print(f"唯一文本 {len(items)} 条 × {len(accents)} 个口音 = {len(items)*len(accents)} 个文件")

    # 哈希冲突自检
    names = {}
    dup = 0
    for k, v in items:
        h = fname(k)
        if h in names and names[h] != k:
            dup += 1
            print(f"  ⚠️ 哈希冲突 {h}: {names[h]} vs {k}")
        names[h] = k
    print(f"哈希冲突 {dup} 处")

    if a.dry_run:
        return

    AUDIO.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(a.concurrency)
    t0 = time.time()
    manifests = {}

    for accent in accents:
        stats = {"skip": 0, "youdao": 0, "edge": 0, "fail": 0, "empty": 0, "failed_list": []}
        print(f"\n=== {accent.upper()} ===")
        done = 0
        total = len(items)
        for i in range(0, total, a.concurrency):
            batch = items[i: i + a.concurrency]
            await asyncio.gather(*[gen_one(k, v["raw"], accent, sem, stats) for k, v in batch])
            done += len(batch)
            el = time.time() - t0
            rate = done / el if el else 0
            print(f"  {done}/{total}  有道{stats['youdao']} edge{stats['edge']} "
                  f"跳过{stats['skip']} 失败{stats['fail']}  {rate:.1f}/s", flush=True)
        got = {k: fname(k) for k, _ in items
               if is_good(AUDIO / f"{fname(k)}{'-uk' if accent=='uk' else ''}.mp3")}
        # 增量合并：--limit 试跑时不能把 manifest 截短（2026-09-09 踩过）
        out_mf = AUDIO / ("manifest-uk.json" if accent == "uk" else "manifest.json")
        mf = {}
        if not a.prune and out_mf.exists():
            try:
                mf = json.loads(out_mf.read_text(encoding="utf-8"))
            except Exception:
                mf = {}
        mf.update(got)
        if a.prune:
            keep = {k for k, _ in items}
            mf = {k: v for k, v in mf.items() if k in keep}
        out_mf.write_text(json.dumps(mf, ensure_ascii=False, sort_keys=True), encoding="utf-8")
        manifests[accent] = len(mf)
        print(f"  ✅ {accent}: manifest {len(mf)} 条；失败 {stats['fail']}")
        for k, raw, acc in stats["failed_list"][:20]:
            print(f"     FAIL {acc} {raw}")

    print(f"\n完成，用时 {(time.time()-t0)/60:.1f} 分钟")
    for k, v in manifests.items():
        print(f"  {k}: {v} 条映射")


if __name__ == "__main__":
    asyncio.run(main())
