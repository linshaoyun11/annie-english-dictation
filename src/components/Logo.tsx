interface LogoProps {
  /** 图标边长，默认 88 */
  size?: number;
  /** 是否显示下方的文字部分，默认 true */
  withText?: boolean;
}

/**
 * 「安妮英语听写」LOGO
 * 图标：圆角方形渐变底 + 白色耳机 + 三道声波（听写主题）
 * 文字：中文主名称 + 英文副标题
 */
export default function Logo({ size = 88, withText = true }: LogoProps) {
  return (
    <div className="flex flex-col items-center select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        fill="none"
        aria-label="安妮英语听写"
      >
        <defs>
          <linearGradient id="logoBg" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6C5CE0" />
            <stop offset="1" stopColor="#534AB7" />
          </linearGradient>
          <linearGradient id="logoWave" x1="48" y1="34" x2="48" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8FF0CD" />
            <stop offset="1" stopColor="#1D9E75" />
          </linearGradient>
        </defs>

        {/* 圆角方形底 */}
        <rect x="4" y="4" width="88" height="88" rx="24" fill="url(#logoBg)" />

        {/* 装饰光斑 */}
        <circle cx="26" cy="24" r="18" fill="#FFFFFF" opacity="0.10" />
        <circle cx="76" cy="80" r="22" fill="#FFFFFF" opacity="0.08" />

        {/* 耳机头梁 */}
        <path
          d="M28 56v-6a20 20 0 0 1 40 0v6"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* 左耳罩 */}
        <rect x="20" y="52" width="12" height="20" rx="6" fill="#FFFFFF" />
        {/* 右耳罩 */}
        <rect x="64" y="52" width="12" height="20" rx="6" fill="#FFFFFF" />

        {/* 中间声波（三道弧线，像嘴在说话/也在听） */}
        <path
          d="M42 42c-2.5 3.5-2.5 8.5 0 12"
          stroke="url(#logoWave)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M48 38c-4 5-4 15 0 20"
          stroke="url(#logoWave)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M54 42c-2.5 3.5-2.5 8.5 0 12"
          stroke="url(#logoWave)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>

      {withText && (
        <div className="mt-4 flex flex-col items-center">
          <h1 className="text-[22px] font-semibold tracking-wide text-text">
            安妮英语听写
          </h1>
          <p className="mt-1 text-[11px] tracking-[0.18em] text-text3 uppercase">
            Annie&#39;s English Dictation
          </p>
        </div>
      )}
    </div>
  );
}
