# -*- coding: utf-8 -*-
"""
用豆包（火山引擎）TTS 生成对比样本音频，与现有有道/Edge 音频对比效果。

鉴权（二选一，通过环境变量传入）：
  新版控制台: DOUBAO_API_KEY=xxx
  旧版控制台: DOUBAO_APPID=xxx DOUBAO_TOKEN=xxx

接口: POST https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse
资源: seed-tts-2.0（对应 *_uranus_bigtts 音色）

输出: .workbuddy/tts-samples/doubao-<voice简称>_<slug>.mp3

用法:
  python scripts/generate_doubao_samples.py            # 生成全部音色样本
  python scripts/generate_doubao_samples.py dacey      # 只生成 Dacey 音色
"""
import base64
import json
import os
import sys
import time
import uuid

import requests

API_URL = "https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse"
RESOURCE_ID = "seed-tts-2.0"

# 音色（seed-tts-2.0 专用 *_uranus_bigtts 系列）
VOICES = {
    "vivi": "zh_female_vv_uranus_bigtts",      # Vivi 2.0 温暖女声（中英混读）
    "dacey": "en_female_dacey_uranus_bigtts",  # Dacey 自然美式女声
    "stokie": "en_female_stokie_uranus_bigtts", # Stokie 英文女声
}

# 对比样本：覆盖单词 / 短语 / 句子，与 .workbuddy/tts-samples 下已有的
# youdao_/edge_ 样本文本保持一致，方便直接对比
SAMPLES = [
    "schoolbag",
    "excuse me",
    "go straight on",
    "beautiful",
    "Wednesday",
    "elephant",
    "Where is the science museum?",
    "I usually go to school by bus.",
]

OUT_DIR = os.path.join(".workbuddy", "tts-samples")


def build_headers():
    api_key = os.environ.get("DOUBAO_API_KEY", "").strip()
    appid = os.environ.get("DOUBAO_APPID", "").strip()
    token = os.environ.get("DOUBAO_TOKEN", "").strip()
    headers = {"X-Api-Resource-Id": RESOURCE_ID, "Content-Type": "application/json"}
    if api_key:
        headers["X-Api-Key"] = api_key
    elif appid and token:
        headers["X-Api-App-Id"] = appid
        headers["X-Api-Access-Key"] = token
    else:
        print("错误：未提供凭据。请设置环境变量 DOUBAO_API_KEY（新版控制台）"
              "或 DOUBAO_APPID + DOUBAO_TOKEN（旧版控制台）。")
        sys.exit(1)
    return headers


def synth(session, headers, text, voice, retries=3):
    """调用 SSE 接口合成一段音频，返回 mp3 字节。"""
    body = {
        "user": {"uid": "annie-dictation-sample"},
        "req_params": {
            "text": text,
            "speaker": voice,
            "audio_params": {"format": "mp3", "sample_rate": 24000},
        },
    }
    # 英文专属音色时明确指定语种，中文音色（如 Vivi 中英混读）则自动识别
    if voice.startswith("en_"):
        body["req_params"]["additions"] = json.dumps({"explicit_language": "en"})
    for attempt in range(1, retries + 1):
        try:
            resp = session.post(
                API_URL,
                headers={**headers, "X-Api-Request-Id": str(uuid.uuid4())},
                json=body,
                stream=True,
                timeout=60,
            )
            if resp.status_code == 429 or resp.status_code >= 500:
                wait = 2 ** attempt
                print(f"    HTTP {resp.status_code}，{wait}s 后重试 ({attempt}/{retries})")
                time.sleep(wait)
                continue
            if resp.status_code != 200:
                print(f"    HTTP {resp.status_code}: {resp.text[:200]}")
                return None

            audio = bytearray()
            for line in resp.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data:"):
                    continue
                try:
                    msg = json.loads(line[5:].strip())
                except json.JSONDecodeError:
                    continue
                code = msg.get("code", -1)
                if code == 20000000:      # SessionFinish
                    break
                if code == 152:           # SessionFinish (SSE 事件)
                    break
                if code not in (0, 351, 352):
                    print(f"    接口错误 code={code} message={msg.get('message')}")
                    return None
                data = msg.get("data")
                if data:
                    audio.extend(base64.b64decode(data))
            return bytes(audio) if audio else None
        except requests.RequestException as e:
            wait = 2 ** attempt
            print(f"    网络异常: {e}，{wait}s 后重试 ({attempt}/{retries})")
            time.sleep(wait)
    return None


def slug(text):
    return "".join(c if c.isalnum() else "-" for c in text.lower()).strip("-")[:40]


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    voices = {k: v for k, v in VOICES.items() if not only or k == only}
    if not voices:
        print(f"未知音色: {only}，可选: {', '.join(VOICES)}")
        sys.exit(1)

    headers = build_headers()
    os.makedirs(OUT_DIR, exist_ok=True)
    session = requests.Session()

    ok = fail = 0
    for short, voice in voices.items():
        print(f"===== 音色 {short} ({voice}) =====")
        for text in SAMPLES:
            out = os.path.join(OUT_DIR, f"doubao-{short}_{slug(text)}.mp3")
            print(f"  合成: {text}")
            audio = synth(session, headers, text, voice)
            if audio:
                with open(out, "wb") as f:
                    f.write(audio)
                print(f"    -> {out} ({len(audio)} 字节)")
                ok += 1
            else:
                print(f"    -> 失败: {text}")
                fail += 1
            time.sleep(0.3)  # 轻微限速，避免并发限流

    print(f"\n完成: 成功 {ok} / 失败 {fail}")
    if fail:
        sys.exit(2)


if __name__ == "__main__":
    main()
