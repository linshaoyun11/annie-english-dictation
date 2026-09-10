interface SoundWaveProps {
  active: boolean;
  onClick?: () => void;
  /**
   * 尺寸档位，与 LearningCard 的字母格档位联动：
   *   normal —— 单词/短句（h-28，与历史版本一致）；
   *   xs     —— 长句降档后配套缩小，为字母格腾出竖向空间；
   *   xxs    —— 小屏最后一档，再缩一号。
   */
  size?: "normal" | "xs" | "xxs";
}

const BARS = [0.4, 0.9, 0.55, 1, 0.65, 0.85, 0.45, 0.75, 0.5, 0.95, 0.6, 0.8, 0.4, 0.7];

const SIZE = {
  normal: { box: "h-28 w-52 gap-[6px] px-6 pb-5 pt-8", bar: 44, base: 10, barW: 6 },
  xs: { box: "h-20 w-40 gap-[4px] px-4 pb-3 pt-5", bar: 30, base: 8, barW: 6 },
  xxs: { box: "h-14 w-36 gap-[3px] px-3 pb-2 pt-3", bar: 18, base: 6, barW: 5 },
} as const;

export default function SoundWave({ active, onClick, size = "normal" }: SoundWaveProps) {
  const s = SIZE[size];
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={active ? "正在朗读，点击重听" : "点击播放朗读"}
      className={`flex items-end justify-center rounded-[32px] bg-primary-lighter transition-transform select-none active:scale-[0.98] ${s.box}`}
      style={{ cursor: "pointer" }}
    >
      {BARS.map((h, i) => (
        <span
          key={i}
          className="rounded-full bg-primary"
          style={{
            width: `${s.barW}px`,
            height: `${Math.round(h * s.bar) + s.base}px`,
            opacity: active ? 1 : 0.35,
            transformOrigin: "bottom",
            animation: active
              ? `waveBar 1.1s ease-in-out ${i * 0.08}s infinite alternate`
              : "none",
            transition: "opacity .3s",
          }}
        />
      ))}
    </button>
  );
}
