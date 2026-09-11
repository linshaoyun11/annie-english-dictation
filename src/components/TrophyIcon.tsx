import type { ImgHTMLAttributes } from "react";
import trophyImg from "../assets/trophy-celebration-v2.png";

/**
 * TrophyIcon — 祝贺页奖杯图标
 *
 * 2026-09-05 改为外部参考图（卡通 3D 风格）：与 SunIcon/StarIcon 风格
 * 不一致（它们是 App 风格的扁平 2D），但用户明确选择「完全照搬嵌入 PNG」。
 * ⚠️ 注意：祝贺页奖杯**正下方**就是 `SunIcon/StarIcon size={56}`，
 * 两者风格差异会在同屏显现——如需协调后续单独处理。
 *
 * 2026-09-11 替换为新版奖杯（底座带 Congratulations! 铭牌、更多彩带）：
 *   资源 `src/assets/trophy-celebration-v2.png`（1024×1024 RGBA）。
 *   源图为豆包 AI 生成 JPG（棋盘格背景烤进图片），抠图处理：
 *   ① 边界泛洪去棋盘背景；② 14 个封闭口袋（把手圈内等）棋盘残留按
 *   「灰格占比>30%」判别清除；③ 杯身白色高光（均匀纯白）保留；
 *   ④ 清除右下角"豆包AI生成"水印；⑤ 1px 羽化、裁边、1024×1024。
 *   脚本 `.workbuddy/tmp/trophy_cutout.py`。换图必须换文件名（-v2），
 *   否则 iPad Safari 强缓存会继续显示旧奖杯。
 *
 * 接口保持与 SVG 版一致：`size` 控制宽度（正方形），`className` 等透传。
 */

interface TrophyIconProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> {
  size?: number;
}

export function TrophyIcon({ size = 120, className, ...rest }: TrophyIconProps) {
  return (
    <img
      src={trophyImg}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      {...rest}
    />
  );
}

export default TrophyIcon;