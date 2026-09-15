#!/usr/bin/env bash
# App Store 截图生成的启动器：拉起无头 Edge → 把 CDP 地址传给截图脚本 → 收尾。
#
#   bash scripts/appstore_shots_run.sh
#
# 为什么需要单独一个启动器（三个坑，都真踩过）：
#   1. puppeteer.launch() 在本机会让 Edge 立刻崩（报 "Code: 0"、stderr 为空、
#      user-data-dir 里只建出 Crashpad 目录）。把 Edge 单独拉起、脚本用
#      puppeteer.connect() 依附，就正常。
#   2. --remote-debugging-port 必须给 0（由系统分配）再读 DevToolsActivePort；
#      指定固定端口时 Edge 起不来。
#   3. Edge 用 `&` 启动会随外层 bash 调用结束被杀，所以浏览器和截图脚本
#      必须放在**同一条命令**里跑。
#
# 前置：另开终端跑开发服务器 `npx vite --port 5180 --strictPort`

set -u

EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
PROJ="/c/Users/huawei/WorkBuddy/2026-08-17-22-58-27"
PROFILE_DIR="$PROJ/.workbuddy/tmp/edge-shots"
PROFILE_WIN='C:\Users\huawei\WorkBuddy\2026-08-17-22-58-27\.workbuddy\tmp\edge-shots'

# 只杀无头调试实例，不动用户自己开的 Edge
taskkill //F //IM msedge.exe >/dev/null 2>&1
sleep 1
# 注意：不要 rm -rf 这个目录（沙箱 safe-delete 会失败并中断脚本）；
# 同名目录复用即可，Edge 自己会清理。
mkdir -p "$PROFILE_DIR"

"$EDGE" \
  --remote-debugging-port=0 \
  --user-data-dir="$PROFILE_WIN" \
  --headless=new --no-sandbox --disable-gpu --disable-gpu-sandbox --no-zygote \
  --hide-scrollbars --force-color-profile=srgb \
  --no-first-run --no-default-browser-check \
  about:blank >/dev/null 2>&1 &
EDGE_PID=$!

PORT=""
for _ in $(seq 1 20); do
  sleep 1
  if [ -f "$PROFILE_DIR/DevToolsActivePort" ]; then
    PORT=$(head -1 "$PROFILE_DIR/DevToolsActivePort")
    break
  fi
done

if [ -z "$PORT" ]; then
  echo "❌ 浏览器未能启动（没生成 DevToolsActivePort）"
  taskkill //F //IM msedge.exe >/dev/null 2>&1
  exit 1
fi
echo "✅ 浏览器就绪，CDP 端口 $PORT"

cd "$PROJ" || exit 1
SHOTS_CDP="http://127.0.0.1:$PORT" node scripts/appstore_shots.mjs
RC=$?

kill "$EDGE_PID" 2>/dev/null
taskkill //F //IM msedge.exe >/dev/null 2>&1
exit $RC
