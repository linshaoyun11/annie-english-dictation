import { memo } from "react";

/**
 * iOS 数字键盘的 T9 小字母标注（1 与 0 没有标注）。
 * 与系统键盘一致，纯装饰，不参与输入。
 */
const SUB_LABEL: Record<string, string> = {
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
};

export interface NumberPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  className?: string;
}

/**
 * 自绘数字键盘（4 位数字密码用）。
 *
 * **为什么自绘**：系统数字键盘是浮层，iOS WKWebView 不会自动把 input 滚进
 * 可视区。RegisterPage 原来走「--kb-h + 手动 scrollBy」补偿，实测在
 * Capacitor 里仍把密码框整个盖住（2026-09-15 用户报障）。自绘键盘**参与
 * flex 布局**（不是浮层），出现时直接把内容区高度让出来 —— 结构上不可能
 * 遮挡，也不再依赖 keyboardWillShow 事件是否按时到达。
 *
 * **尺寸与配色**：按用户给的 iOS 截图逐像素量取（截图 828×1792 对应
 * 390×844pt，即 2.123 px/pt），全部换算成 CSS px（1:1 对应 pt）：
 *   - 面板 #403F44 —— 取整块面板像素的**中位数**（rgb 64,63,68，p10~p90 几乎无方差）；
 *     早期版本我按边缘单点采样写成 #3A3C49（偏蓝 15 个色阶），是采样点踩在
 *     圆角/JPEG 边缘上导致的误判
 *   - 键帽 122.5×47.1 → 高度取 47px（宽度由等分自动得出）
 *   - 列 / 行间距 5.7px，键帽圆角 **10px**（由「距顶 1pt 处内缩 5.2pt」反解），
 *     键帽色 #5E5D62（同为整块中位数；截图中键帽**没有**纵向渐变，实测平坦）
 *   - 面板顶部圆角 24px、左右 padding 5px、顶部 padding 22px
 *   - 数字 21px 纯白（量得数字 cap 高 14.6pt）
 *   - 小字母 9.5px #D4D3D8（量得 cap 高 6.6pt）
 *   - 第 4 行：0 居中（与第 2 列对齐），⌫ **没有键帽底**，图标直接落在面板上
 *   - 底部留白 = 安全区 + 38px（截图实测键帽底到屏底 74pt，其中安全区 34pt）
 * 详见 `.workbuddy/memory/topics/ui-conventions.md`。
 */
function NumberPad({ onDigit, onBackspace, className = "" }: NumberPadProps) {
  /**
   * 用 pointerdown 而不是 click：与系统键盘一样「手指按下即出字」。
   * click 要等 touchend，比原生晚 80~150ms。
   * preventDefault 会一并抑制后续合成的 mousedown/mouseup/click，
   * 所以不会重复输入，也让按钮永不获得焦点。
   * （本键盘没有「答对判定」，不存在 LearningCard 那类「手指还按着就判定」
   *   的时序问题。）
   */
  const press = (fn: () => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    fn();
  };

  const keyCls =
    "flex h-[47px] flex-1 basis-0 touch-manipulation select-none flex-col items-center justify-center rounded-[10px] bg-[#5E5D62] shadow-[0_1px_0_rgba(0,0,0,0.22)] transition-[transform,background-color] duration-75 active:scale-[0.96] active:bg-[#75757A]";

  const digitKey = (d: string) => (
    <button
      key={d}
      type="button"
      aria-label={d}
      onPointerDown={press(() => onDigit(d))}
      onContextMenu={(e) => e.preventDefault()}
      className={keyCls}
    >
      <span className="text-[21px] leading-none text-white">{d}</span>
      {SUB_LABEL[d] && (
        <span className="mt-[5px] text-[9.5px] leading-none tracking-[0.14em] text-[#D4D3D8]">
          {SUB_LABEL[d]}
        </span>
      )}
    </button>
  );

  return (
    <div
      /* 供上层手势/点击识别排除（与 SpellingInput 的 data-dictation-keyboard 同套路） */
      data-number-pad=""
      /* 空 touchstart 监听：iOS 只在元素（或其祖先）注册了 touch 类监听时，
         才会在手指按下的一刻应用 :active。没有它按键要等 touchend 才高亮，
         观感是「按下去没反应」。回调本身不需要做事。 */
      onTouchStart={() => {}}
      className={`shrink-0 select-none rounded-t-[24px] bg-[#403F44] px-[5px] pt-[22px] ${className}`}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 38px)" }}
    >
      <div className="mx-auto w-full max-w-[420px]">
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
        ].map((row, ri) => (
          <div key={ri} className={`flex gap-[5.7px] ${ri === 0 ? "" : "mt-[5.7px]"}`}>
            {row.map(digitKey)}
          </div>
        ))}

        {/* 第 4 行：左侧留空 → 0 与第 2 列对齐 → ⌫ 落在第 3 列 */}
        <div className="mt-[5.7px] flex gap-[5.7px]">
          <span className="flex-1 basis-0" aria-hidden="true" />
          {digitKey("0")}
          <button
            type="button"
            aria-label="删除"
            onPointerDown={press(onBackspace)}
            onContextMenu={(e) => e.preventDefault()}
            /* ⌫ 无键帽底（与用户截图一致），只有图标 + 按压缩放反馈 */
            className="flex h-[47px] flex-1 basis-0 touch-manipulation select-none items-center justify-center rounded-[6px] text-[#E8E8EC] transition-transform duration-75 active:scale-[0.92]"
          >
            {/* 与 SpellingInput 同一枚 iOS 删除键图标：上/下/右三边直线带圆角，
                左边 V 形尖 + 内部 X */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 5 H9 L3 12 L9 19 H20 A2 2 0 0 0 22 17 V7 A2 2 0 0 0 20 5 Z" />
              <path d="M13 9 L19 15 M19 9 L13 15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(NumberPad);
