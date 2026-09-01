/**
 * 学习轮数标识：每通关一轮得一颗星星，每 2 颗星星合成一个太阳；
 * 最多 5 个太阳（= 10 轮）后轮数不再累计。
 *
 * 显示规则（rounds 为已完成的轮数）：
 * - 1 轮  → 1 颗星星
 * - 2 轮  → 1 个太阳（星星清零，合成太阳）
 * - 3 轮  → 1 个太阳 + 1 颗星星
 * - 10 轮 → 5 个太阳（满级）
 */

/** 轮数上限：5 个太阳 × 2 颗星星 */
export const MAX_ROUNDS = 10;

/** 已合成的太阳数（0~5） */
export function sunsOf(rounds: number): number {
  return Math.min(Math.floor(rounds / 2), 5);
}

/** 剩余星星数（0~1，满级后为 0） */
export function starsOf(rounds: number): number {
  if (rounds >= MAX_ROUNDS) return 0;
  return rounds % 2;
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

/**
 * 太阳光芒：8 个实心尖三角（viewBox 24 坐标系，中心 12,12）
 * 三角底边贴中心盘（半径 6.2）→ 尖角朝外到半径 10.6；前 4 个为正方向，后 4 个为斜角。
 */
const SUN_RAYS = [
  "10.5,5.8 13.5,5.8 12,1.4",
  "10.5,18.2 13.5,18.2 12,22.6",
  "5.8,10.5 5.8,13.5 1.4,12",
  "18.2,10.5 18.2,13.5 22.6,12",
  "15.32,17.45 17.45,15.32 19.5,19.5",
  "6.56,15.32 8.68,17.45 4.51,19.5",
  "8.68,6.56 6.56,8.68 4.51,4.51",
  "17.45,8.68 15.32,6.56 19.5,4.51",
];

/**
 * 橙金色太阳：8 个实心尖三角 + 中心圆盘（比星星更"高阶"的暖橙色调）
 * 不做小尺寸简化：8 个尖三角一律保留，与首页徽章保持一致的辨识度。
 */
export function SunIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      {SUN_RAYS.map((points, i) => (
        <polygon key={i} points={points} fill="#F59E0B" />
      ))}
      <circle
        cx="12"
        cy="12"
        r="6.4"
        fill="#FFA726"
        stroke="#E8890B"
        strokeWidth="1.2"
      />
      {/* 中心高光 */}
      <circle cx="10.6" cy="10.6" r="1.9" fill="#FFCC66" />
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
