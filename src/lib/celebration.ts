/* ── 单元完成祝贺音效 ──
 *
 * 首选 HTMLAudioElement 播放本地 wav（public/audio/celebration.wav）：
 * - 与词条朗读走同一条音频管线（AVAudioSession playback），音量通道一致；
 * - Web Audio 的 AudioContext 在 iOS 上长时间运行后可能进入 suspended
 *   且无法自动恢复（表现：学久了祝贺音效无声，切后台回来才响），
 *   HTMLAudioElement 不受此影响。
 * Web Audio 合成仅作为文件缺失/播放失败时的兜底。
 */

let jingleEl: HTMLAudioElement | null = null;
let jingleCtx: AudioContext | null = null;

/* ── 兜底：Web Audio 合成（三角波琶音 + 和弦） ── */

function getCtx(): AudioContext | null {
  try {
    if (!jingleCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      jingleCtx = new AC();
    }
    if (jingleCtx.state === "suspended") void jingleCtx.resume();
    return jingleCtx;
  } catch {
    return null;
  }
}

/** 播放单个音符（三角波 + 快速起音/指数衰减包络） */
function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  vol = 0.16,
  type: OscillatorType = "triangle"
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function synthJingle() {
  const c = getCtx();
  if (!c) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(c, f, i * 0.14, 0.32));
  // 结尾和弦：C6 + E6 + G6 齐响 + 低音 C 打底
  const chordStart = notes.length * 0.14;
  [1046.5, 1318.5, 1568.0].forEach((f) =>
    tone(c, f, chordStart, 0.85, 0.1)
  );
  tone(c, 261.63, 0, chordStart + 0.85, 0.08, "sine");
}

/**
 * 播放简短庆祝音效（本地 wav，约 1.2 秒的红白机风格过关号角）。
 * 失败时静默降级到 Web Audio 合成（无音频环境不影响功能）。
 */
export function playCelebrationJingle() {
  try {
    if (!jingleEl) {
      jingleEl = new Audio(
        `${import.meta.env.BASE_URL}audio/celebration.wav`
      );
      jingleEl.preload = "auto";
    }
    // 复用同一元素：load() 重置到初始状态（ended 元素不 load 无法重播）
    jingleEl.load();
    const p = jingleEl.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => synthJingle());
    }
  } catch {
    synthJingle();
  }
}
