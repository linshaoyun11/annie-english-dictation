/**
 * 学习轮数标识：每通关一轮得一颗星星，每 5 颗星星合成一个太阳；
 * 最多 5 个太阳（= 25 轮）后轮数不再累计。
 *
 * 显示规则（rounds 为已完成的轮数）：
 * - 3 轮  → 3 颗星星
 * - 5 轮  → 1 个太阳（星星清零，合成太阳）
 * - 7 轮  → 1 个太阳 + 2 颗星星
 * - 25 轮 → 5 个太阳（满级）
 */

/** 轮数上限：5 个太阳 × 5 颗星星 */
export const MAX_ROUNDS = 25;

/** 已合成的太阳数（0~5） */
export function sunsOf(rounds: number): number {
  return Math.min(Math.floor(rounds / 5), 5);
}

/** 剩余星星数（0~4，满级后为 0） */
export function starsOf(rounds: number): number {
  if (rounds >= MAX_ROUNDS) return 0;
  return rounds % 5;
}

/** 金色五角星（与主题 --color-gold #f5b800 同系） */
export function StarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      <polygon
        points="12,2.5 14.47,9.1 21.51,9.41 15.99,13.8 17.88,20.59 12,16.7 6.12,20.59 8.01,13.8 2.49,9.41 9.53,9.1"
        fill="#F5B800"
        stroke="#D89A00"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* 顶部高光，让星体有立体感 */}
      <polygon
        points="12,4.6 13.62,9.35 10.38,9.35"
        fill="#FFD75E"
        stroke="none"
      />
    </svg>
  );
}

/** 橙金色太阳：中心圆盘 + 8 道光芒（比星星更"高阶"的暖橙色调） */
export function SunIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      {/* 8 道光芒 */}
      <g
        stroke="#F59E0B"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <line x1="12" y1="1.8" x2="12" y2="4.6" />
        <line x1="12" y1="19.4" x2="12" y2="22.2" />
        <line x1="1.8" y1="12" x2="4.6" y2="12" />
        <line x1="19.4" y1="12" x2="22.2" y2="12" />
        <line x1="4.8" y1="4.8" x2="6.8" y2="6.8" />
        <line x1="17.2" y1="17.2" x2="19.2" y2="19.2" />
        <line x1="19.2" y1="4.8" x2="17.2" y2="6.8" />
        <line x1="4.8" y1="19.2" x2="6.8" y2="17.2" />
      </g>
      {/* 中心圆盘 */}
      <circle
        cx="12"
        cy="12"
        r="5.4"
        fill="#FFA726"
        stroke="#E8890B"
        strokeWidth="1.2"
      />
      {/* 中心高光 */}
      <circle cx="10.6" cy="10.6" r="1.7" fill="#FFCC66" />
    </svg>
  );
}

/** 按轮数渲染「太阳 + 星星」组合 */
export default function RoundsStars({
  rounds,
  size = 26,
}: {
  rounds: number;
  /** 图标基准尺寸（太阳），星星略小 */
  size?: number;
}) {
  const suns = sunsOf(rounds);
  const stars = starsOf(rounds);
  if (suns === 0 && stars === 0) return null;
  return (
    <span
      className="inline-flex flex-wrap items-center justify-center gap-1"
      role="img"
      aria-label={`已完整学完 ${rounds} 轮：${suns} 个太阳、${stars} 颗星星`}
    >
      {Array.from({ length: suns }).map((_, i) => (
        <SunIcon key={`sun-${i}`} size={size} />
      ))}
      {Array.from({ length: stars }).map((_, i) => (
        <StarIcon key={`star-${i}`} size={size * 0.85} />
      ))}
    </span>
  );
}
