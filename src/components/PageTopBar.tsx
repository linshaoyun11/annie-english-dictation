import { useEffect, useRef, useState, type ReactNode } from "react";

interface PageTopBarProps {
  /** 顶部栏内容（返回键 + 标题 + 右侧操作区…） */
  children: ReactNode;
  /** 追加到外层的类名（一般不需要；默认已含吸顶 / 贴边 / 内边距） */
  className?: string;
}

/**
 * 页面顶部栏（吸顶）。滚动内容时返回键 / 标题 / 右侧操作（头像等）固定在顶部，
 * 不随内容滑走；内容从它下方穿过。
 *
 * ⚠️ 使用约束：**必须是滚动容器的直接（或任意层级）子元素**。组件靠向上查找
 * 最近的 `overflow-y: auto|scroll` 祖先来监听滚动，找不到就退化为 window。
 *
 * 贴边原理：父级滚动容器带 `px-5`，这里用 `-mx-5 px-5` 把**背景**铺到容器左右
 * 边缘（否则内容会从两侧 20px 的缝里露出来），同时让内容仍保持 20px 内缩 ——
 * 也就是说未滚动时版面与不带吸顶时**逐像素一致**。
 *
 * 阴影只在「已滚过阈值」时出现：`stuck` 只在跨过阈值的那一刻 setState，
 * 不随每一帧滚动触发重渲染；且阴影用 box-shadow（不占布局），
 * 所以切换时版面不会跳动 1px。
 *
 * `pb-3 -mb-3`（成对出现，缺一不可）：给下沿那条发丝线留 12px 呼吸位 ——
 * 否则返回键 / 头像这两个 36px 圆按钮的**圆底正好压在线身上**。
 * 负 margin 抵消 padding 对流内占位的影响，所以后续内容的 y 坐标**不变**：
 * 相邻 margin 塌陷后 28 + (−12) = 16px，而盒底由 68 落到 80，相加仍是 96。
 * ⚠️ 也别改成「只在 stuck 时加 pb-3」——那会让顶栏盒高在滚动的一瞬间长高 12px，
 * 底部 12px 的内容突然被盖住，出现一次可见的跳动。
 */
export default function PageTopBar({ children, className = "" }: PageTopBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 找最近的纵向滚动祖先；找不到就用 window（例如整页滚动的场景）
    let scroller: HTMLElement | null = null;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if (oy === "auto" || oy === "scroll") {
        scroller = p;
        break;
      }
    }

    const readTop = () =>
      scroller ? scroller.scrollTop : window.scrollY || document.documentElement.scrollTop;

    const onScroll = () => {
      const next = readTop() > 2;
      setStuck((prev) => (prev === next ? prev : next));
    };

    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={ref}
      data-topbar=""
      className={`sticky top-0 z-20 -mx-5 -mb-3 flex items-center gap-3 bg-bg px-5 pt-8 pb-3 transition-shadow duration-200 ${
        stuck
          ? "shadow-[0_8px_16px_-10px_rgba(83,74,183,0.35),inset_0_-1px_0_rgba(83,74,183,0.10)]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
