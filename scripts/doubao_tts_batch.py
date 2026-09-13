# 豆包(v3 seed-tts-2.0)批量重生成短语/句子音频：美音 Dacey、英音 Stokie。
# - key 从环境变量 DOUBAO_TTS_KEY 读取（不进 git）
# - 同名覆盖 public/audio/{fid}.mp3 / {fid}-uk.mp3（git 历史即备份）
# - 断点续传：done 清单落在 .workbuddy/tmp/doubao-done.json
# - 校验：size>1KB 且魔数合法（ID3 / FF Fx），失败重试 3 次后记入 failed 清单
import asyncio, base64, json, os, sys, urllib.request, uuid, hashlib

KEY = os.environ["DOUBAO_TTS_KEY"]
URL = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
RESOURCE = "seed-tts-2.0"
VOICES = {"us": "en_female_dacey_uranus_bigtts", "uk": "en_female_stokie_uranus_bigtts"}
AUDIO_DIR = "public/audio"
TMP = ".workbuddy/tmp"
DONE_FILE = f"{TMP}/doubao-done.json"
FAIL_FILE = f"{TMP}/doubao-failed.json"
CONC = int(os.environ.get("DOUBAO_CONC", "6"))

manifest_us = json.load(open(f"{AUDIO_DIR}/manifest.json", encoding="utf-8"))
manifest_uk = json.load(open(f"{AUDIO_DIR}/manifest-uk.json", encoding="utf-8"))

def clean_tts_text(text: str) -> str:
    t = text.strip()
    if t.startswith("*"):
        t = t.lstrip("*").strip()
    t = t.replace("’", "'").replace("‘", "'")
    # 省略号占位（would rather ... than ...）→ 去省略号
    t = t.replace(" ... ", " ").replace("...", "")
    t = " ".join(t.split())
    return t

def magic_ok(data: bytes) -> bool:
    return len(data) > 1024 and data[:2] in (b"ID", b"\xff\xfb", b"\xff\xf3",
                                             b"\xff\xf2", b"\xff\xfa", b"\xff\xe3")

async def synth(voice: str, text: str) -> bytes:
    body = {"user": {"uid": "annie-dictation"},
            "req_params": {"text": text, "speaker": voice,
                           "audio_params": {"format": "mp3", "sample_rate": 24000}}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST")
    for k, v in [("Content-Type", "application/json"), ("X-Api-Key", KEY),
                 ("X-Api-Resource-Id", RESOURCE), ("X-Api-Request-Id", str(uuid.uuid4()))]:
        req.add_header(k, v)
    def _do():
        with urllib.request.urlopen(req, timeout=90) as r:
            raw = r.read().decode("utf-8", "replace")
        chunks = []
        for line in raw.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                line = line[5:].strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            if obj.get("code") == 0 and obj.get("data"):
                chunks.append(base64.b64decode(obj["data"]))
            elif obj.get("code") not in (0, None, 20000000):
                raise RuntimeError(f"api {obj.get('code')}: {obj.get('message','')[:80]}")
        return b"".join(chunks)
    return await asyncio.get_event_loop().run_in_executor(None, _do)

async def worker(name, queue, done, failed, lock):
    while True:
        item = await queue.get()
        if item is None:
            queue.task_done()
            return
        text, key, fid = item
        try:
            for accent, suffix in (("us", ""), ("uk", "-uk")):
                out = f"{AUDIO_DIR}/{fid}{suffix}.mp3"
                ok = False
                for attempt in range(3):
                    try:
                        data = await synth(VOICES[accent], clean_tts_text(text))
                        if magic_ok(data):
                            with open(out, "wb") as f:
                                f.write(data)
                            ok = True
                            break
                    except Exception:
                        await asyncio.sleep(1.5 * (attempt + 1))
                if not ok:
                    async with lock:
                        failed.append({"text": text, "accent": accent, "fid": fid})
            async with lock:
                done[key] = True
                if len(done) % 50 == 0:
                    json.dump(done, open(DONE_FILE, "w"))
                    json.dump(failed, open(FAIL_FILE, "w"))
                    print(f"进度 {len(done)} / {total}，失败 {len(failed)}", flush=True)
        finally:
            queue.task_done()

items_raw = json.load(open(f"{TMP}/all-texts.json", encoding="utf-8"))
done = json.load(open(DONE_FILE)) if os.path.exists(DONE_FILE) else {}
failed = []
items = []
for r in items_raw:
    if r["key"] in done:
        continue
    fid = manifest_us.get(r["key"])
    if not fid:
        print(f"!! manifest 无 key: {r['key']!r}", flush=True)
        continue
    items.append((r["text"], r["key"], fid))
total = len(done) + len(items)
print(f"目标 {total} 条文本 × 2 口音；待生成 {len(items)} 条", flush=True)

async def main():
    queue = asyncio.Queue()
    lock = asyncio.Lock()
    workers = [asyncio.create_task(worker(i, queue, done, failed, lock)) for i in range(CONC)]
    for it in items:
        await queue.put(it)
    for _ in workers:
        await queue.put(None)
    await asyncio.gather(*workers)
    json.dump(done, open(DONE_FILE, "w"))
    json.dump(failed, open(FAIL_FILE, "w"))
    print(f"完成 {len(done)}/{total}，失败 {len(failed)}", flush=True)
    for f in failed[:20]:
        print("  FAIL:", f, flush=True)

asyncio.run(main())
