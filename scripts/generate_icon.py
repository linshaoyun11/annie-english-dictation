# -*- coding: utf-8 -*-
"""
按 src/components/Logo.tsx 的矢量参数重绘 App 图标。

iOS App Store 图标要求：1024x1024、不透明（满幅方图，系统自动切圆角），
因此与 Logo 的差异仅在于：渐变背景铺满整图（去掉 4px 边距），图案保持原比例。

用法：
  <venv-python> scripts/generate_icon.py
输出：
  assets/app-icon-1024.png   —— CI 打包用的主图标
  assets/app-icon-{20..180}.png、app-icon.png —— 其余尺寸同步重生成
  app-icons/icon-preview.png —— 圆角预览（模拟主屏效果，仅供参考，不参与打包）
"""

from PIL import Image, ImageDraw
import math
import os

D = 4096          # 4x 超采样，缩小后得到平滑抗锯齿边缘
S = D / 96.0      # Logo viewBox 为 96x96

PURPLE_TOP = (0x6C, 0x5C, 0xE0)
PURPLE_BOTTOM = (0x53, 0x4A, 0xB7)
WAVE_TOP = (0x8F, 0xF0, 0xCD)
WAVE_BOTTOM = (0x1D, 0x9E, 0x75)
WHITE = (255, 255, 255, 255)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def lerp_color(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))


def build_master():
    # 1) 对角线渐变背景（(0,0) -> (96,96)，与 Logo 的 linearGradient 一致）
    small = Image.new("RGB", (96, 96))
    px = small.load()
    for y in range(96):
        for x in range(96):
            px[x, y] = lerp_color(PURPLE_TOP, PURPLE_BOTTOM, (x + y) / 192.0)
    img = small.resize((D, D), Image.BILINEAR).convert("RGBA")

    ov = Image.new("RGBA", (D, D), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)

    def circle(cx, cy, r, fill):
        od.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=fill)

    # 2) 装饰光斑（与 Logo 相同：10% / 8% 白色）
    circle(26, 24, 18, (255, 255, 255, int(0.10 * 255)))
    circle(76, 80, 22, (255, 255, 255, int(0.08 * 255)))

    # 3) 耳机头梁：M28 56 v-6 a20 20 0 0 1 40 0 v6（白色描边 5）
    # 直接用填充多边形描绘 stroke 的外轮廓，避免 PIL 圆弧端点与线段接头
    # 产生额外凸起，确保与 Logo.tsx 的 SVG 渲染 1:1。
    def stroke_arc(cx, cy, r, start_deg, end_deg, n=80):
        pts = []
        for i in range(n + 1):
            a = math.radians(start_deg + (end_deg - start_deg) * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        return pts

    band_outer_r = 20 + 2.5
    band_inner_r = 20 - 2.5
    headphone_outline = (
        [(25.5, 56), (25.5, 50)]
        + stroke_arc(48, 50, band_outer_r, 180, 360)
        + [(70.5, 50), (70.5, 56), (65.5, 56), (65.5, 50)]
        + stroke_arc(48, 50, band_inner_r, 360, 180)
        + [(30.5, 50), (30.5, 56)]
    )
    scaled_headphone = [(x * S, y * S) for x, y in headphone_outline]
    od.polygon(scaled_headphone, fill=WHITE)

    # 4) 左右耳罩（白色圆角矩形 r=6）
    od.rounded_rectangle([20 * S, 52 * S, 32 * S, 72 * S], radius=6 * S, fill=WHITE)
    od.rounded_rectangle([64 * S, 52 * S, 76 * S, 72 * S], radius=6 * S, fill=WHITE)

    # 5) 三道声波（垂直渐变 #8FF0CD -> #1D9E75，描边 4，圆头）
    def bezier(p0, p1, p2, p3, n=48):
        pts = []
        for i in range(n + 1):
            t = i / n
            mt = 1 - t
            pts.append((
                mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t ** 3 * p3[0],
                mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t ** 3 * p3[1],
            ))
        return pts

    waves = [
        ((42, 42), (39.5, 45.5), (39.5, 50.5), (42, 54)),
        ((48, 38), (44, 43), (44, 53), (48, 58)),
        ((54, 42), (51.5, 45.5), (51.5, 50.5), (54, 54)),
    ]
    wave_w = int(round(4 * S))
    for p0, p1, p2, p3 in waves:
        pts = bezier(p0, p1, p2, p3)
        for i in range(len(pts) - 1):
            (x1, y1), (x2, y2) = pts[i], pts[i + 1]
            t = min(max(((y1 + y2) / 2 - 34) / 30.0, 0.0), 1.0)
            col = lerp_color(WAVE_TOP, WAVE_BOTTOM, t) + (255,)
            od.line([x1 * S, y1 * S, x2 * S, y2 * S], fill=col, width=wave_w)
            circle(x2, y2, 2, col)  # 圆头连接

    img = Image.alpha_composite(img, ov)
    return img.resize((1024, 1024), Image.LANCZOS)


def main():
    master = build_master()

    # 主图标（不透明 RGB，符合 App Store 要求）
    icon = master.convert("RGB")
    icon.save(os.path.join(ROOT, "assets", "app-icon-1024.png"), optimize=True)

    # 其余尺寸同步重生成（当前无引用，仅为保持一致）
    for size in (180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20):
        icon.resize((size, size), Image.LANCZOS).save(
            os.path.join(ROOT, "assets", f"app-icon-{size}.png"), optimize=True)
    icon.resize((512, 512), Image.LANCZOS).save(
        os.path.join(ROOT, "assets", "app-icon.png"), optimize=True)

    # 圆角预览（模拟 iOS 主屏效果，仅供参考）
    preview = Image.new("RGB", (1024, 1024), (255, 255, 255))
    mask = Image.new("L", (1024, 1024), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 1023, 1023], radius=24 / 96 * 1024, fill=255)
    preview.paste(icon, (0, 0), mask)
    preview.save(os.path.join(ROOT, "app-icons", "icon-preview.png"), optimize=True)

    print("done: assets/app-icon-1024.png + 12 sizes + app-icons/icon-preview.png")


if __name__ == "__main__":
    main()
