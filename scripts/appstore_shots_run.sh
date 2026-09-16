#!/usr/bin/env bash
# App Store 截图生成入口（薄封装）。
#
#   bash scripts/appstore_shots_run.sh
#
# 需要的开发服务器：另开终端 `npx vite --port 5180 --strictPort`
#
# 拉起无头 Edge 的细节（三个坑）已抽到 scripts/headless_edge_run.sh，两个入口共用。
# 可调开关见 scripts/appstore_shots.mjs 头部：SHOTS_CHROME / SHOTS_INSETS / SHOTS_OUT。

set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$HERE/headless_edge_run.sh" "$HERE/appstore_shots.mjs"
