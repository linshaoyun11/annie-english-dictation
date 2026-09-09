# build 78 音频修复验证清单

装包后按本清单走一遍，约 3 分钟即可确认「音频与文本错位」是否根治。

## 背景

- 你报的问题：人教三起 G3U1 显示 `name`，却听到 `point`。
- 根因：音频文件以 `entry.id` 命名，词库重建后 id 整体位移 ⇒ 结构性地张冠李戴。
- 修复：文件名改为**文本哈希**（`t + blake2b(文本)`），文本与文件在同一次调用内绑定。
- 全量字节级核查：9730 条（6 线 × 美/英），**0 不匹配**。

本次验证的目的不是再查文件内容（已逐条验过），而是确认
**端到端链路**（manifest 加载 → 文件加载 → 播放）在真机上没有问题。

## 判定标准

听到的发音 == 屏幕上显示的英文单词。不一致就把单词记下来。

## 第 1 步：主验证（你报的单元，必做）

设置 → 教材线选**人教（三年级起点）** → 三年级 → Unit 1 **Making friends**

| # | 显示 | 音标 | 该听到 |
|---|---|---|---|
| 1 | **name** | /neɪm/ | ← 重点，以前这里念的是 point |
| 2 | nice | /naɪs/ | |
| 3 | ear | /ɪə(r)/ | |
| 4 | hand | /hænd/ | |
| 5 | eye | /aɪ/ | |
| 6 | mouth | /maʊθ/ | |
| 7 | arm | /ɑːm/ | |
| 8 | can | /kən, kæn/ | |
| 9 | share | /ʃeə(r)/ | |
| 10 | smile | /smaɪl/ | |
| 11 | listen | /ˈlɪsn/ | |
| 12 | help | /help/ | |

12 条全对 ⇒ 主问题已解决。

## 第 2 步：跨线抽查（确认不是只修好一条线）

每条线换一次教材线即可，只需听前 3 个词。

| 教材线 | 年级 / 单元 | 前 3 词 |
|---|---|---|
| 人教（一年级起点） | G1U1 School | book / ruler / pencil |
| 人教（三年级起点） | G3U1 Making friends | name / nice / ear（第 1 步已听） |
| 外研（一年级起点） | G1U1 Module 1 你好 | Hello! / Hi! / I |
| 外研（三年级起点） | G3U1 Welcome to school | welcome / to / school |
| 牛津 | G1U1 Greetings | morning / afternoon / Hello! |
| 仁爱 | G7U1 Let's Be Friends! | let / be / friend |

> 注：外研三起从三年级起、仁爱从七年级起，设置里看不到更低年级是正常的。

## 第 3 步：口音切换

设置里切到**英音**，把第 1 步的 `name`、`listen`、`school` 各听一遍。
美音/英音是两套独立文件（`{hash}.mp3` / `{hash}-uk.mp3`），两者都要确认。

## 第 4 步：短语抽查（短语比单词更容易串位）

人教三起 G3U1 之后任意单元，或仁爱 G7U1（137 词，含大量短语），
挑几个**多词短语/句子**听——短语在旧库里错位比例高于单词。

## 如果仍有词不对

直接把**屏幕上显示的英文**发我即可。现在文件名就是文本哈希，
`manifest[文本]` 查到文件名是 O(1)，能立刻定位并用字节级核查判定是
文件内容问题还是播放链路问题。

## 附：常用排查命令

```bash
# 查某个词对应哪个音频文件
python -c "import json;print(json.load(open('public/audio/manifest.json',encoding='utf-8'))['name'])"

# 全量字节级核查（9730 条，约 18 分钟）
python scripts/verify_full_bytes.py --concurrency 14 --out scripts/full_verify.csv

# 内容核查（双音源 + 原始大小写）
python scripts/verify_audio_content.py --file <文件名(不含.mp3)> --text <文本>
```
