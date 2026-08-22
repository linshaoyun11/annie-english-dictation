"""把 emoji 头像从 Windows Segoe UI Emoji 字体渲染为 PNG 图片。
这样 iOS / Android / 浏览器都会显示和本地浏览器完全一致的微软 emoji 画风。
"""
import os
import json
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = r"C:\Windows\Fonts\seguiemj.ttf"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "avatars")
SIZE = 256  # 高清，Retina 屏幕也清晰

AVATARS = [
    ("dog", "🐶"),
    ("cat", "🐱"),
    ("panda", "🐼"),
    ("fox", "🦊"),
    ("lion", "🦁"),
    ("frog", "🐸"),
    ("octopus", "🐙"),
    ("unicorn", "🦄"),
    ("tiger", "🐯"),
    ("monkey", "🐵"),
    ("pig", "🐷"),
    ("rabbit", "🐰"),
    ("bear", "🐻"),
    ("penguin", "🐧"),
    ("chick", "🐤"),
    ("dragon", "🐲"),
]


def render(id_: str, emoji: str) -> str:
    os.makedirs(OUT_DIR, exist_ok=True)
    font = ImageFont.truetype(FONT_PATH, int(SIZE * 0.85))
    img = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    # anchor='mm' 居中
    draw.text((SIZE // 2, SIZE // 2), emoji, font=font, embedded_color=True, anchor="mm")
    # 裁切掉透明边距
    bbox = img.getbbox()
    if bbox:
        margin = max(2, SIZE // 64)
        left, top, right, bottom = bbox
        left = max(0, left - margin)
        top = max(0, top - margin)
        right = min(SIZE, right + margin)
        bottom = min(SIZE, bottom + margin)
        img = img.crop((left, top, right, bottom))
    out_path = os.path.join(OUT_DIR, f"{id_}.png")
    img.save(out_path)
    return out_path


def main():
    if not os.path.exists(FONT_PATH):
        raise RuntimeError(f"找不到 Windows emoji 字体：{FONT_PATH}")
    manifest = []
    for id_, emoji in AVATARS:
        path = render(id_, emoji)
        manifest.append({"id": id_, "emoji": emoji, "path": path})
        print(f"generated {id_}.png")
    print(f"\nall done: {len(manifest)} avatars -> {OUT_DIR}")


if __name__ == "__main__":
    main()
