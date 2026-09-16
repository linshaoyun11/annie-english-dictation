#!/usr/bin/env bash
# 在无头 Edge 里跑一个 Node 脚本（脚本通过 CDP 依附到浏览器），跑完自动收尾。
#
#   bash scripts/headless_edge_run.sh <脚本.mjs> [参数…]
#
# 脚本从环境变量 $EDGE_CDP 拿依附地址（形如 http://127.0.0.1:53303）。
#
# 为什么要有这个启动器 —— 三个坑，全都真踩过：
#   1. puppeteer.launch() 在本机会让 Edge 立刻崩（报 "Code: 0"、stderr 为空、
#      user-data-dir 里只建出 Crashpad 目录）。把 Edge 单独拉起、脚本用
#      puppeteer.connect() 依附，就正常。
#   2. --remote-debugging-port 必须给 0（由系统分配）再读 DevToolsActivePort；
#      指定固定端口时 Edge 起不来。
#   3. Edge 用 `&` 启动会随外层 bash 调用结束被回收 ⇒ 浏览器和脚本必须放在
#      **同一条命令**里跑，不能分两次调用。
#
# 前置：开发服务器已在跑（`npx vite --port 5180 --strictPort`）。
# 视口由脚本自己 setViewport —— 启动器不参与（要真机级 dpr 就在脚本里设）。
#
# 用法示例：
#   bash scripts/headless_edge_run.sh scripts/appstore_shots.mjs
#   bash scripts/headless_edge_run.sh scripts/test_delete_user.mjs

set -u

EDGE="${EDGE_BIN:-/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe}"
PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE_DIR="$PROJ/.workbuddy/tmp/${EDGE_PROFILE:-edge-run}"
# Edge 要 Windows 形式的路径
PROFILE_WIN="$(cygpath -w "$PROFILE_DIR" 2>/dev/null || echo "$PROFILE_DIR")"

if [ $# -lt 1 ]; then
  echo "用法：bash scripts/headless_edge_run.sh <脚本.mjs> [参数…]" >&2
  exit 2
fi

# 只杀无头调试实例，不动用户自己开的 Edge
taskkill //F //IM msedge.exe >/dev/null 2>&1
sleep 1
# 不要 rm -rf 这个目录（沙箱 safe-delete 会失败并中断脚本）；同名目录复用即可
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
  echo "❌ 无头 Edge 未能启动（没生成 DevToolsActivePort）" >&2
  taskkill //F //IM msedge.exe >/dev/null 2>&1
  exit 1
fi
echo "✅ 无头 Edge 就绪，CDP 端口 $PORT"

cd "$PROJ" || exit 1
EDGE_CDP="http://127.0.0.1:$PORT" node "$@"
RC=$?

kill "$EDGE_PID" 2>/dev/null
taskkill //F //IM msedge.exe >/dev/null 2>&1
exit $RC
