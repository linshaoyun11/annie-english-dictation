# 音频流水线（TTS 音源 / 码率 / 生成脚本）

> 2026-09-05 实测整理。动手生成音频前必读。

## ⛔ Edge 脚本「全量覆盖」铁律（2026-09-07 踩坑后写下）

- 任何带 **"全部改用 Edge" / "重生成全部 ra-" / `--add-failed` 覆盖现有** 的脚本，
  **绝对不允许在用户没明确确认的情况下跑**。会无脑覆盖存量有道音频，造成不可逆丢失。
- 上一会话误启 `regen_renai_edge.py`，22:51 期间已覆写 1 个文件 + 留下 1 个 0 字节残文件；
  提前用 `TaskStop` 拦截返回 503，没完全成功。
- 安全范式：Edge 只用于**兜底**（有道 500 / 产出超长 / 产出 <1KB / 缺失），
  且要 --dry-run 先列出，确认无误再写。
- 现存安全兜底脚本：`scripts/fix_renai_oversized.py`（白名单式，仅修异常文件）。
- 危险的 `scripts/regen_renai_edge.py` **已删除**；如果将来有「全量刷一遍」需求，
  必须新写带「分块 + 每块前提示」的脚本，**禁用**直接对存量文件无脑 `Communicate.save`。

## 🔴 音源现状（2026-09-07 **重新实测**：有道已恢复，是首选音源）

> ⚠️ 本文件 2026-09-05 曾记「有道已死」。**2026-09-07 复测结论相反**——
> 有道对仁爱缺失词取样 20 条 **美 20/20、英 20/20 全部 200**。
> **每次批量生成前先跑 20 条取样脚本实测，不要照搬历史结论。**

| 音源 | 端点 | 美音 | 英音 | 原生格式 | 需代理 |
|---|---|---|---|---|---|
| **有道 dictvoice（首选）** | `dict.youdao.com/dictvoice?audio=X&type=2\|1` | ✅ | ✅ | 64k / 48kHz mono | 否 |
| **Edge TTS** | `edge_tts.Communicate(text, voice)` | ✅ | ✅ | **48k / 24kHz mono** | 否 |
| 谷歌 translate_tts | `translate.google.com/translate_tts?...&tl=..&client=tw-ob` | ✅ | ✅ | 64k / 24kHz mono | **是** |
| 百度 gettts | `fanyi.baidu.com/gettts?lan=en&text=X&spd=3&source=web` | ✅ | ❌ | — | 否 |

### 有道可用性：两次结论反转（都要知道）

**2026-09-05（当时"已死"）**：需新合成的文本一律 500；抽样失败率 美 28% / 英 22%；
词典已有录音的词能返回。⇒ 当时新增词条拿不到。

**🟢 2026-09-07（现在可用）**：取样仁爱缺失词 20 条（web / yo-yo / indoors / tai chi /
rainforest / grassland / cactus / highland / thirteenth / fortieth / ninth / confucius /
republic / midnight / shopper / payment / colored / beginning / coastline / turning）
⇒ **美音 20/20、英音 20/20 全部 200，无 500**。

**实操约定（2026-09-07 起）**
1. 优先级：**有道（美 type=2 / 英 type=1）> Edge 兜底**。用户明确要求优先有道，
   Edge 只在有道 500 或产出**不可用**（超长 / 残缺）时启用。
2. 批量前先取样 20 条实测，按结果定音源；有道不可用时再退 Edge。
3. **⚠️ 质量隐患**：有道英音部分词条返回**超长音频**——实测 indoors 132KB、
   grassland 141KB、cactus 135KB、ninth 131KB（正常单词应 5–30KB），疑为含例句
   或异常录音。⇒ 生成后必须按体积筛一轮，**>60KB 或 <1KB 改用 Edge 兜底**。
4. TTS 喂文本 ≠ 词表英文：词条若含 `*` 标记或 ` ... ` 省略号，TTS 念不出来，
   必须先清洗（`*hungry` → `hungry`；`would rather ... than ...` → `would rather than`）。

### 仁爱线超长音频列表（2026-09-07 实测 48 个 >60KB，已全部 Edge 兜底）
详见 `scripts/fix_renai_oversized.py` 的 FAILED_IDS + 一次性扫描输出。
再次出现同样症状的判据：**单条单词 > 60KB 或 < 1KB 视为有道异常**。

### ⛔ id 算法必须全局递增（2026-09-08 踩坑，外研三起 G7-G9）

**陷阱**：`mk.ts` 的 `mkWithPrefix` 用 `prefixSeqs: Map<prefix, number>`，**全文件
全局递增**，对所有 `mk("wy", ...)` 都 +1（不管 grade）。

如果解析教材 .ts 写离线脚本时错把 G3-G6 的 n += 1 跳过：
```python
# ❌ 错误
for m in MK.finditer(src):
    g, u = ...
    if not (7 <= g <= 9): continue
    n += 1
    id = f"wy-g{g}u{u}e{n:04d}"  # ← n 错了！junior high 应是 wy-g7u0e1188 不是 wy-g7u0e0005
```

**正确范式**：
```python
# ✅ 正确
for m in MK.finditer(src):
    g, u = ...
    n += 1  # 永远累计，不管 grade
    if not (7 <= g <= 9): continue
    id = f"wy-g{g}u{u}e{n:04d}"
```

下载的文件名（`wy-g7u0e0005.mp3`）跟真实 id（`wy-g7u0e1188`）错位，
App 端 `manifest.get("junior high") = "wy-g7u0e1188"` 找不到文件 → 静默漏播。

**诊断**：audit_app_playback 报 N 个漏播但实跑新文件后仍漏 → 立刻怀疑 id 算法。
修复：`parse_waiyanshe` 中 `n += 1` 必须在 grade 过滤**之前**。

**善后**：错 id 文件已生成（如 `wy-g7u0e00xx.mp3`）→ 用
`scripts/_cleanup_wy_orphans.py` 一键清掉（既不在 valid_ids 也不在 manifest.values）。
2026-09-08 实测清掉外研三起 503 个孤儿 / 6.5 MB。

### ⛔ App 端路径审计 vs file-level audit 是两件事（2026-09-07 + 08 双踩）

**正确评估流程**（`scripts/audit_renai_gaps.mjs` / `scripts/audit_waiyanshe_playback.mjs`）：
1. 对每条词条：`text = english.trim().toLowerCase()`，`usId = manifest[text]`
2. 查 `public/audio/{usId}.mp3` 是否存在且 1KB<size<60KB
3. 漏 = manifest 无 id 或文件异常。**不要**去查 entry.id 自己的文件
4. 真理脚本会输出"OK / 漏播"两类，**只看 OK 数 / 总数**

### ⛔ manifest 是两份独立字典：us / uk（2026-09-08 补齐 5 短句时踩）

`public/audio/` 下：
- `manifest.json`  → 美音（type=2）
- `manifest-uk.json` → 英音（type=1）

二者结构一致，但**键是分开维护**。补漏脚本必须**两份都写**，否则 audit 会报
`no-manifest`。

第一次写 `scripts/fill_waiyanshe_5.mjs` 只写主 manifest → 4 个英音仍报 no-manifest。
第二版同时写两份 → 全绿。

**硬阈值：60KB 上限对齐 audit**（2026-09-08 收敛）
- audit 真值是 `1KB ≤ size ≤ 60KB`（`scripts/audit_all_playback.mjs:14-15`）
- fold 美音有道返回 60230B 略超阈 → 被 audit 标 `huge(60230B)` → 实际上是合法单词
  但有道"词+例句"录得太长；Edge Aria 9.8KB 紧凑单词体量才是理想输出
- 自写补漏脚本务必把阈值同步成 60000，不能 120KB，否则会留下 audit 永远报 huge 的文件

**坑**（外研三起实拍中第二次踩）：
- 修了 id 算法后跑 `generate_waiyanshe_g7g9.py` 输出"美音缺口: 1 / 新增 manifest: 1"
  看似只跑了 1 个，实际文件**全部生成**了——因为断点续传 A 跳过（自己文件已合格）
- 但 manifest 没写入新文本 key（因为 A 跳过走不到 update_manifest）
- 结果：文件有了，但 manifest 不指向 → App 端仍漏播
- 修复：另跑 `scripts/fix_waiyanshe_manifest.mjs` 一次性把"已生成但 manifest 没指向"
  的 entry 写回 manifest（167 美音 + 208 英音）

### ⛔ 「音频缺口」必须从 App 端视角评估（2026-09-07 大修正）

**之前犯的错**：按"id 是否有 mp3"做文件级 audit，得出 48 + 9 = 58 个需要补。
**真相**：仁爱 2388 条里 App 端**只漏 10 个**（`node scripts/audit_renai_gaps.mjs` 实测）。

原因在 App 的播放逻辑（`src/lib/audio.ts`）：
```ts
const id = manifest.get(text.trim().toLowerCase());
return `${BASE_URL}audio/${id}${variant==="uk"?"-uk":""}.mp3`;
```
- manifest 是**全局唯一**的 `text → id` 映射（不同教材同文本走同一 id）
- 所以同一个英文单词，**只要 manifest 命中、文件存在，App 就能播**——
  不管那个 id 是 g/wy/ox/ra 哪个前缀
- 「某 ra- id 没 mp3」不等于「App 漏」—— 也许 text 已经被 manifest 指到 g/wy/ox 上

**正确评估流程**：
1. 对每条词条 entry.english：`text = english.toLowerCase()`，`usId = manifest[text]`
2. 查 `public/audio/{usId}.mp3` 是否存在且 1KB<size<60KB
3. 漏 = manifest 无 id 或文件异常。**不要**去查 entry.id 自己的文件
4. `audit_renai_gaps.mjs` 是当前真理脚本

**TTS 文本清洗**：`would rather ... than ...` 喂 TTS 时去省略号
（`would rather than`），但 manifest key 仍用原文（含省略号）。App 查文本时
会命中 entry.english 直传，播的就是"would rather than"——听感过得去。

### 谷歌 locale 对照表（md5 实测）

- `tl=en` = `en-GB` = `en-UK` = `en-ZA` = `en-IE` → **同一把嗓音（英音）**
- `tl=en-US` = `en-CA` → 美音
- `tl=en-AU` / `en-IN` / `en-NZ` → 各自不同
- ✅ MFCC-DTW 验证：`tl=en` 距英音组 8.65 < 距美音组 10.64 → 确实是英音
  （我 2026-09-05 一度误判"谷歌无英音"，已纠正）

### 韵律客观指标（ffmpeg 解码 + 自相关 F0，脚本 `.workbuddy/tmp/analyze_prosody.py`）

长句 "All work and no play makes Jack a dull boy."：

| 音源 | 时长s | F0均值 | F0标准差 | F0跨度 | F0斜率 | jitter |
|---|---|---|---|---|---|---|
| 谷歌(美) | 3.41 | 221.3 | 48.4 | 113.3 | -49.1 | 0.031 |
| Edge Aria | 3.38 | 198.1 | 40.0 | 98.9 | -63.3 | 0.026 |
| Edge Sonia | 3.02 | 212.3 | 44.5 | 112.9 | -62.2 | 0.028 |
| Edge Ryan | 3.50 | 146.8 | 68.6 | 150.3 | -25.4 | 0.089 |
| 百度 | 4.21 | 192.9 | 47.2 | 120.8 | -42.3 | 0.035 |

⇒ 谷歌与 Edge 在韵律上**同一水平**，数据上并不更"机器音"。最终要用户耳朵判。

## 🔴 存量音频 bug：305 个 .mp3 其实是 WAV（已修复）

有道 `dictvoice` 偶尔返回 **RIFF/WAV** 但 `Content-Type` 仍写 `audio/mpeg`；
旧脚本只校验 `buf.length >= 1000` ⇒ WAV 被写进 .mp3（浏览器靠嗅探仍能播，未暴露）。
305 个、36.4 MB、占全库 34%，全部 48kHz/16bit/mono（768 kbps）。

**⚠️ 铁律：写音频前必须校验魔数**，不能只看长度：
`体积 ≥1024 且 前3字节 ∈ (ID3, FF FB, FF F3, FF F2, FF FA, FF E3)`。

## 码率决策（2026-09-06 全库已收口，三组优化全部做完）

- **Edge TTS 原生就是 `48 kbps / 24000 Hz / 单声道`** ⇒ 用 Edge 天然满足 48 kbps，
  **零转码、零质量损失**。这是选 Edge 的最大理由。

存量转码实测（LSD = 对数谱失真，**必须带限 100Hz–11kHz** 并对功率谱设 −60dB 底噪，
否则目标码率把高频砍光 → log(0) 爆掉 → 算出 15–27 dB 的荒谬值）：

| 分组 | 个数 | 前 → 后 | 省 | LSD@48k |
|---|---|---|---|---|
| WAV 伪装 (768k) | 305 | 36.4 → 2.5 MB | 33.9 MB | 1.5–2.4 dB |
| >100k 真 MP3 | 704 | 21.3 → 7.2 MB | 14.1 MB | 1.84 dB |
| 64k 真 MP3 | 3863 | 41.1 → 31.6 MB | 9.4 MB | **1.37 dB** |

判读：LSD <1 dB 察觉不出；1–2 dB 很轻微；>2 dB 可能可闻。
64k 组失真最低 ⇒ 既然接受了 1.84 dB，没理由拒绝 1.37 dB，**已一并做完**。

### ✅ 全库最终状态（2026-09-06，commit 540696d）

| 项 | 值 |
|---|---|
| 文件数 | 8867（新增 3184 + 原有 5683） |
| 总占用 | **82.7 MB**（起点 106.6 MB ⇒ 多装 3184 个反而 **−23.9 MB**） |
| 码率 | **≤52 kbps 100%** |
| 声道 | mono 100% |
| 采样率 | 24000Hz 8758 / 16000Hz 101 / 22050Hz 7 / 11025Hz 1 |
| WAV 伪装 | **0** |
| 覆盖率 | 6 条线 × 美英双语 **100%**（4005 条运行时文本） |

剩余 109 个非 24kHz 是历史遗留、本就 ≤52 kbps，iOS 正常播放，未纳入转码。
备份在 `.workbuddy/audio-backup/`（3636 个原档，已 gitignore）。

## 音频查表机制（关键）

`src/lib/audio.ts:96` = `manifest.get(text.trim().toLowerCase())`
⇒ **音频只按文本查，不碰 entry.id**。改词库 id 不会让音频失配。
⇒ 新音频只需一个不与现有文件名冲突的新 id 命名空间（已分配 `n00001…n01592`）。

## 任务清单

`scripts/build_audio_tasks.mjs` → `.workbuddy/tmp/audio-tasks.json`

- 运行时去重文本 **4005**，缺 **1592**（美音英音各缺 1592，两条线完全对齐、无单缺）
- 类型：word 834 / phrase 359 / sentence 411；长度 min 2 / 中位 10 / p95 41 / max 84
- 缺口**全部来自 renjiao / renjiao3**；waiyanshe / waiyanshe3 / oxford / renai 覆盖率 100%
  （这 4 条线是精简版，用词都被 renjiao3 覆盖过）

## 环境

- **无系统 ffmpeg** → `imageio-ffmpeg` 提供静态二进制：
  `C:/Users/huawei/.workbuddy/binaries/python/envs/default/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe`
  ⚠️ `pip install imageio-ffmpeg` 装了 **18 分钟**，用 run_in_background
- `lameenc` 已装（Python LAME 绑定，如需重编码）
- 无 ffmpeg 时用 `.workbuddy/tmp/probe_mp3.py` 纯 Python 解析 MP3 帧头
  （坑：MPEG2/2.5 的 Layer II 与 Layer III **共用一张码率表**，key 是 `(ver,2)`）

## ⚠️ 代理（谷歌专用）

- 用户代理 = **SOCKS5 `127.0.0.1:10808`**（v2ray 系），用户说**临时、可能失效**
- 沙箱自带 `http_proxy=http://127.0.0.1:34465` 会**拦截并拒绝** google（DNS 11001）
  ⇒ 必须显式 `curl -x socks5h://127.0.0.1:10808`，Node fetch 需 undici ProxyAgent
- 探测端口用 `netstat -ano -p tcp | grep LISTEN`（`reg.exe` 被沙箱黑名单拦截）

## 生成脚本

| 脚本 | 用途 |
|---|---|
| `scripts/generate_audio.mjs` | 有道美音（2026-09-07 复测**已恢复可用**，见顶部） |
| `scripts/generate_audio_uk.mjs` | 有道英音 type=1（同上，**已恢复**） |
| **`scripts/generate_audio_renai.mjs`** | **仁爱专用：有道优先（--strict-youdao 可关百度兜底）**；id `ra-g{g}u{u}e{0001}`；断点续传；`--us/--uk/--limit=N` |
| `scripts/generate_audio_editions.mjs` | 外研/牛津，有道 + 百度补全 |
| `scripts/generate_audio_uk_edge.py` | **Edge 英音短语重做（可复用的 Edge 范式）** |
| `scripts/build_audio_tasks.mjs` | 构建缺失清单（运行时口径） |
| **`scripts/generate_audio_edge.py`** | **Edge 批量生成主力**（魔数校验 + 断点续传 + 增量落盘） |
| **`scripts/fill_waiyanshe_5.mjs`** | **小批量补漏范式**（5 短句 × 美英 = 10 文件；同时写两份 manifest；60KB 硬上限对齐 audit；有道 500/超阈自动 Edge 兜底） |
| **`scripts/fix_renai_oversized.py`** | **仁爱音频兜底**：扫 >60KB / <1KB / FAILED_IDS 缺失，Edge 兜底重生成；`--dry-run` 列出 |
| `scripts/optimize_audio.py` | 存量转码 `--scope wav\|high\|all`、`--kbps`、`--sr`、`--dry-run`（带备份） |
| `scripts/verify_audio_final.mjs` | 覆盖 + 文件实体 + **魔数** + 各线覆盖 + 孤儿 + 体积 |
| `scripts/list_orphan_audio.mjs` | 孤儿键分析 |

生成 3184 个文件实测 **24 分钟，2.2 个/秒，零失败**。

⚠️ 坑：ESM 里用 `require()` 会**静默失败**，导致终检误报「文件缺失 4005」。
必须 `import { statSync, openSync, readSync, closeSync } from "node:fs"`。

### 孤儿键 197 个（4.3 MB）**刻意保留**

`DifficultWordsPage.tsx:102` 为**用户生词本**里的词调 `resolveAudio`，而生词本本地持久化
⇒ 老用户可能还存着重建前的旧词（`teacher's desk`、`maths book` 等）。
删掉会让他们的生词本发不出声（退化为系统 speechSynthesis）。4.3 MB 买这个保险划算。

### ⚠️ 已知：美音两种音色混用

原有 2610 条 = 有道美音；新增 1592 条 = Edge Aria。**英音是一致的**（Sonia 同源）。
若要全库统一，对现有 2610 条重跑 Edge 即可（约 4005×2 个文件，30 分钟）。

Edge 范式要点：`edge_tts.Communicate(text, voice)` → `await save(out)`，
并发用 `asyncio.Semaphore(4)`，失败指数退避 `1.5 * attempt`，校验 `size > 1024`。
⚠️ 直接写目标文件，不要 tmp+move（沙箱拦截 unlink）。

---

## 🔍 音频/文本错位排查（2026-09-09 建立，可复用）

用户报「听到 A 词的音、看到 B 词的提示」时，按下面 5 步排查。
**结论：结构性错位可 100% 排除，唯一无法程序化验证的是 mp3 人声内容（需 ASR/人工听审）。**

### ① manifest 多对一（真错位，已修过 9 处）
一个 id 被多个 text 绑定 ⇒ 必有 text 播错音。
```python
id2text = defaultdict(list)
for t, i in manifest.items(): id2text[i].append(t)
multi = {k: v for k, v in id2text.items() if len(v) > 1}
```
修法：保留先入者，删后续重复 key。被删的 text 运行时回退 speechSynthesis。
排查脚本 `dist_audit/audit_id_mismatch.mjs`（tsc 编译 src/data 后跑，用完删）。

### ② 播放链路是否精确匹配
`src/lib/audio.ts:96` = `manifest.get(text.trim().toLowerCase())` —— **精确查表，
无模糊兜底**；未命中返回 null → speechSynthesis 读当前 text。
⇒ 不存在「查不到就播别的词」。这条可直接排除。

### ③ 生成脚本是否有索引偏移
`scripts/generate_audio_edge.py:127-134`：
`key, text, tid = t["key"], t["text"], t["id"]` + `out = AUDIO / f"{tid}.mp3"`
text 与文件名来自**同一 task 对象** ⇒ 不可能 off-by-one。

### ④ US/UK 时长交叉校验（排除随机错录）
US 与 UK 是**两次独立 TTS 生成**。同一 text 若两个文件时长差 >45% 且 >0.5s → 可疑。
实测 0 差异 ⇒ 排除单文件随机录错（两次不可能错成同一个词还时长相同）。

### ⑤ 时长 vs 文本长度离群（排除系统性整体串位）
按文本字符数分桶取时长中位数，算 ratio。实测异常 36/5331 = 0.67%，偏长仅 2 条。
**若存在整体偏移，异常率应接近 100%** ⇒ 反证没有系统性串位。
脚本：`scripts/audit_audio_duration.py`（保留）
⚠️ 文件大小差异 ≠ 时长差异（Edge 输出码率 32–160kbps 不等），必须解析帧头算时长。

### ⑥ 数据字段串位（english 与 phonetic/chinese 不匹配）
粗扫「同一 english 音标/释义不一致」会出 2104 组，**全是噪音**（多义词、
英美音标写法差异）。必须消噪：
1. 只取第一个 `/.../` 段（忽略 `; /.../` 双音标、`(pl. deer)` 补充说明）
2. 归一化英美 `(r)`：ɑːr/ɜːr/ɔːr/ɪər/eər/ʊər/ər/ːr → 去 r
消噪后实测 29 条，**全为英美音标差异，0 条真串位**。
脚本：`scripts/audit_phonetic_outlier2.py`（保留）

### 已知残留（非错位，未修）
- `skier`(wy-g5u7e1003) 3.02s、`swing`(ra-g8u23e1753) 2.66s：音频偏长，US/UK 一致，
  判定为 TTS 拖长音/静音特性
- `am` / `it` / `mm`：english 是缩写，音标念全称（am→/ˌeɪ ˈem/、it→/ˌaɪ ˈtiː/、
  mm→/mɪlɪmiːtər/）；音频按缩写生成，轻微不一致

### 定位单元时的坑
「Making friends」= **renjiao3** G3U1（curriculum.ts:533，首条 name /neɪm/）
「Welcome to school」= **waiyanshe3** G3U1（waiyanshe.ts:480，含 point /pɔɪnt/）
用户常把两条三起线搞混，报 BUG 时先按单元标题定位是哪条线。

---

# 🔴 2026-09-09 重大事故：音频与文本错位（已修复，build 77）

## 现象
用户报「人教三起 G3U1 显示 name，却听到 point」，TestFlight 复现。

## 铁证
`manifest['name'] = wy-g1u2e0020`，而该文件与**有道 "point"** 的 PCM 互相关
**0.9994**（vs 有道 "name" 仅 0.2749）。文件里念的就是 point。

## 根因（结构性）
音频以 **entry.id 命名**，App 靠 `manifest[text] → id → {id}.mp3` 找文件。
id 由 `mk()` 全局序号生成，**词库一重建（G4–G9 / v22 / v23）就整体位移**，
存量音频立刻与词表脱节。叠加多个补齐脚本（fill_*/fix_*）各自按不同列表
配对 text 与 id，进一步错位。⇒ 只要命名依赖 entry id，就必然复发。
（注：上一版"已 100% 排除错位"的结论是错的——只做了 text→id→text 往返自洽，
 两个方向都用当前词表，当然自洽；真正要查的是 **mp3 文件内容**。）

## 修复（build 77）
1. **文件名改为 `t + blake2b(归一化文本, 8 字节).hexdigest()`**，与 entry id 彻底解耦。
   App 端不改逻辑：manifest 的 value 直接当文件名用（`src/lib/audio.ts` 已加注释）。
2. 全量重生成 4865 个唯一文本 × 美/英 = 9730 个文件
   （有道优先，失败 / <1KB / >60KB 走 Edge 兜底）。
3. 删除旧命名文件 15829 个；public/audio 412M → 194M。
4. 结果：**6 条线 × 美/英 = 12 组，覆盖率 100%，缺失 0**。

## ⚠️ 验证判据的两个大坑（都会造成 30%+ 误判）
**坑 1：单音源比对。** 存量库混有道(64k/48kHz)与 Edge(48k/24kHz)。实测
「有道 name vs Edge name」相关度只有 **0.20**，跨音源同词基线普遍 0.2–0.32。
只拿 Edge 当参照会把「音源不同」全判成词错（我第一版虚报成 58%）。
⇒ **必须双音源（有道+Edge）合成候选，取相关度最高值**。

**坑 2：用小写 key 去合成。** 有道对 `ben` / `Ben` 返回**不同录音**
（实测 9206 vs 8640 字节）。合成必须用 `texts-by-line.json` 的 **raw 原始大小写**，
否则又是一片误判（35% → 真值 9%）。

判据自检（必做）：同文件转码 48k/24kHz 后相关度仍 0.9965（对转码免疫）；
正确匹配 ≈1.000；异词 <0.35；阈值取 0.90。
另：`fast_corr` 归一化互相关在窗口方差趋零时会爆炸到几十上百，
必须按 RMS 阈值作废低能量窗口，否则会把"不相同"误判为"相同"（漏判）。

## 实测错位率（修正判据后抽样）
| 口音 | 抽样 | 无法与基准对齐 | 其中明显念错（相关<0.3） |
|---|---|---|---|
| 美音 | 200 | 18 (9.0%) | 13 (6.5%) |
| 英音 | 150 | 22 (14.7%) | — |

新库抽查 60 条：**60/60 全部正确**（4 条与有道原始字节完全一致）。
按线看：renjiao3 单词 40.9% / 短语 63%（旧库，含音源混杂，真错位率见上表）。

## 工具（已提交 scripts/）
- `regen_audio_by_text.py` —— 按文本哈希命名全量重生成（**防错位核心**）
- `verify_audio_content.py` —— 双音源 + raw 大小写的音频内容核查
- `compare_old_new_audio.py` —— 旧/新全量比对，按 6 线 × 2 口音出统计
- `dump_texts_by_line.mjs` —— 导出 文本 → {raw, lines, ids}
- `cleanup_old_audio.py` —— 清理旧命名文件
- `audit_audio_text_mismatch.mjs` —— manifest ↔ 词库 id 自洽审计

## 铁律
- 音频文件名**永远不要**用 entry.id，只能用文本哈希。
- 任何"补齐音频"脚本，text 与 out_path 必须在同一次调用里绑定，
  **禁止两个列表按下标配对**。
- 验证音频正确性前，先做判据自检（转码鲁棒性 + 跨音源基线 + 大小写）。
- 结论"已排除错位"之前，必须验证 **mp3 文件内容**，光查映射自洽没用。
