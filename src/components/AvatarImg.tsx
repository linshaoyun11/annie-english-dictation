import { memo } from "react";

interface AvatarImgProps {
  /** 头像 ID，对应 public/avatars/{id}.png */
  id: string;
  /** 辅助文本（默认取 id） */
  alt?: string;
  /** 额外 Tailwind 类，通常传尺寸控制 */
  className?: string;
}

/**
 * 统一使用 Windows emoji 风格的 PNG 头像，避免 iOS / Android / 浏览器
 * 因系统 emoji 字体不同导致头像外观不一致。
 */
export const AvatarImg = memo(({ id, alt, className = "" }: AvatarImgProps) => (
  <img
    src={`/avatars/${id}.png`}
    alt={alt ?? id}
    draggable={false}
    loading="eager"
    className={`pointer-events-none inline-block h-[1.2em] w-[1.2em] select-none object-contain align-middle ${className}`}
  />
));
