import type { ImgHTMLAttributes } from "react";
import trophyImg from "../assets/trophy-celebration-transparent.png";

/**
 * TrophyIcon — 祝贺页奖杯图标
 *
 * 2026-09-05 改为外部参考图（卡通 3D 风格）：与 SunIcon/StarIcon 风格
 * 不一致（它们是 App 风格的扁平 2D），但用户明确选择「完全照搬嵌入 PNG」。
 * ⚠️ 注意：祝贺页奖杯**正下方**就是 `SunIcon/StarIcon size={56}`，
 * 两者风格差异会在同屏显现——如需协调后续单独处理。
 *
 * 2026-09-09 替换为卡通金色奖杯（带麦穗/彩带/高光）：
 *   资源 `src/assets/trophy-celebration-transparent.png`（1024×1024 RGBA）。
 *   原图为豆包 AI 生成 JPG，已做：① 边缘 flood-fill 去白底；② 右下角水印区域
 *   裁透明；③ 缩放至 1024×1024；④ 保存为 PNG。
 *   文件名加 `-transparent` 后缀是为了让 iPad Safari 等强缓存场景下，
 *   旧 URL `trophy-celebration.png` 完全失效，强制重下载。
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