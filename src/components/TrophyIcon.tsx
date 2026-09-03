import type { SVGProps } from "react";

/**
 * TrophyIcon — 祝贺页奖杯图标（抽象线条版）
 *
 * 设计语言参考 v8 效果图（.workbuddy/preview/celebration-mockup-v8.html）：
 * 零渐变 / 零高光块 / 零阴影，全部 stroke 圆头线条，描边宽度统一 2.8（杯口沿 3.4，
 * 底座下沿 3.4），round cap/linejoin。仅两色：紫 `#534AB7`（杯体 = App 主色）+ 金
 * `#F5B800`（蝴蝶结 + 星徽/星屑）。
 *
 * 三个变体：
 *  - A (default) · 最简 12 笔：杯体 8 笔 + 蝴蝶结 4 笔
 *  - B · 加中央星徽：A + 杯身中央一颗金星
 *  - C · 加星屑：B + 3 颗小金星屑
 */

type TrophyVariant = "A" | "B" | "C";

interface TrophyIconProps extends Omit<SVGProps<SVGSVGElement>, "viewBox"> {
  size?: number;
  variant?: TrophyVariant;
}

const V = "#534AB7"; // 紫：杯体线条（App 主色）
const G = "#F5B800"; // 金：蝴蝶结 + 星

function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push(
      `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`
    );
  }
  return pts.join(" ");
}

export function TrophyIcon({
  size = 120,
  variant = "A",
  className,
  ...rest
}: TrophyIconProps) {
  return (
    <svg
      viewBox="0 0 64 58"
      width={size}
      height={(size * 58) / 64}
      fill="none"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {/* 杯口沿（一条粗横线） */}
      <path
        d="M14 10 H50"
        stroke={V}
        strokeWidth={3.4}
        strokeLinecap="round"
      />

      {/* 杯身（碗形，一条闭合线） */}
      <path
        d="M18 12.5 H46 L41.5 30 Q32 36 22.5 30 Z"
        stroke={V}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 双耳把手（两条 C 弧） */}
      <path
        d="M18 15 C8.5 16 8.5 25.5 20.5 29.5"
        stroke={V}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <path
        d="M46 15 C55.5 16 55.5 25.5 43.5 29.5"
        stroke={V}
        strokeWidth={2.8}
        strokeLinecap="round"
      />

      {/* 杯柱（一条竖线） */}
      <path
        d="M32 33 V42"
        stroke={V}
        strokeWidth={3.2}
        strokeLinecap="round"
      />

      {/* 底座（两条横线：上短下长） */}
      <path
        d="M25.5 44 H38.5"
        stroke={V}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <path
        d="M20.5 49.5 H43.5"
        stroke={V}
        strokeWidth={3.4}
        strokeLinecap="round"
      />

      {/* 杯身中央金星徽（B/C 候选） */}
      {(variant === "B" || variant === "C") && (
        <polygon points={starPoints(32, 21, 4.6)} fill={G} />
      )}

      {/* 蝴蝶结：4 笔（左环 / 右环 / 中央结 / 两条飘带） */}
      <g>
        {/* 中央结（实心小圆，比矩形更圆润） */}
        <circle cx="32" cy="36.8" r="2.4" fill={G} />
        {/* 左环 */}
        <path
          d="M31 36.5 Q21.5 31.5 19 37.5 Q23.5 42 31 36.5 Z"
          stroke={G}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* 右环 */}
        <path
          d="M33 36.5 Q42.5 31.5 45 37.5 Q40.5 42 33 36.5 Z"
          stroke={G}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* 左飘带 */}
        <path
          d="M29.5 39 L22 48"
          stroke={G}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        {/* 右飘带 */}
        <path
          d="M34.5 39 L42 48"
          stroke={G}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      </g>

      {/* 周围小星屑（C 候选） */}
      {variant === "C" && (
        <g>
          <polygon points={starPoints(6, 17, 2.4)} fill={G} />
          <polygon points={starPoints(58, 20, 2.1)} fill={G} />
          <polygon points={starPoints(8, 52, 1.9)} fill={G} />
        </g>
      )}
    </svg>
  );
}

export default TrophyIcon;