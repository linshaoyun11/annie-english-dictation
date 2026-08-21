interface SoundWaveProps {
  active: boolean;
  onClick?: () => void;
}

const BARS = [0.4, 0.9, 0.55, 1, 0.65, 0.85, 0.45, 0.75, 0.5, 0.95, 0.6, 0.8, 0.4, 0.7];

export default function SoundWave({ active, onClick }: SoundWaveProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={active ? "正在朗读，点击重听" : "点击播放朗读"}
      className="flex h-28 w-52 items-end justify-center gap-[6px] rounded-[32px] bg-primary-lighter px-6 pb-5 pt-8 transition-transform select-none active:scale-[0.98]"
      style={{ cursor: "pointer" }}
    >
      {BARS.map((h, i) => (
        <span
          key={i}
          className="w-[6px] rounded-full bg-primary"
          style={{
            height: `${Math.round(h * 44) + 10}px`,
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
