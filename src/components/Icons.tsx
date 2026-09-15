/**
 * 通用线性图标（单色，颜色随 currentColor，由父级 className 控制）。
 *
 * 统一规格：24 视口 / 1.75 描边 / 圆头圆角，与应用其他页面（设置页、首页顶栏、
 * 重点记忆页）的线性图标同一套参数，保证不同尺寸下的观感一致。
 *
 * 来源：用户资料页改版（build 113）。此前该页三处用 emoji（🔑 / 📖 / ⭐），
 * emoji 由系统字体渲染 —— iOS、安卓、浏览器各不相同，且与全站线性图标语言割裂。
 * ⭐ 改用现成的 StarIcon（RoundsStars.tsx，品牌金星），本文件只放需要重画的图标。
 */

interface IconProps {
  /** 边长（px），默认 20 */
  size?: number;
  /** 额外类名，通常传颜色，如 "text-primary" */
  className?: string;
}

/**
 * 钥匙：环形匙柄 + 直齿杆 + 2 齿。
 * 匙柄内 18% 同色填充，与实心金星在视觉份量上对齐；描边圆头，20px 下不糊。
 */
export function KeyIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="7.4" cy="12" r="4.5" fill="currentColor" fillOpacity={0.18} />
      <path d="M11.9 12H20.6" />
      <path d="M16.5 12v3.2" />
      <path d="M19.3 12v2.3" />
    </svg>
  );
}

/**
 * 打开的书：左右两页 + 中缝。
 * 页面 14% 同色填充，避免细线框在深色数字旁边发虚。
 */
export function BookIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* 左页（只填色不描边，轮廓由下方 path 单独画，避免重复描边叠加变粗） */}
      <path
        d="M12 7.3C10.55 6.05 8.8 5.4 6.7 5.4H3.7a.95.95 0 0 0-.95.95v10.3c0 .53.43.95.95.95h3c2.1 0 3.85.65 5.3 1.9z"
        fill="currentColor"
        fillOpacity={0.14}
        stroke="none"
      />
      {/* 右页（只填色不描边） */}
      <path
        d="M12 7.3c1.45-1.25 3.2-1.9 5.3-1.9h3c.52 0 .95.43.95.95v10.3a.95.95 0 0 1-.95.95h-3c-2.1 0-3.85.65-5.3 1.9z"
        fill="currentColor"
        fillOpacity={0.14}
        stroke="none"
      />
      {/* 两页外轮廓（不闭合 → 中缝单独画一条） */}
      <path d="M12 7.3C10.55 6.05 8.8 5.4 6.7 5.4H3.7a.95.95 0 0 0-.95.95v10.3c0 .53.43.95.95.95h3c2.1 0 3.85.65 5.3 1.9" />
      <path d="M12 7.3c1.45-1.25 3.2-1.9 5.3-1.9h3c.52 0 .95.43.95.95v10.3a.95.95 0 0 1-.95.95h-3c-2.1 0-3.85.65-5.3 1.9" />
      <path d="M12 7.3v11.2" />
    </svg>
  );
}
