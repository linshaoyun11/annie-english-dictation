/* ── 单元完成祝贺音效：Web Audio API 合成，纯本地、无资源文件 ── */

let jingleCtx: AudioContext | null = null;

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

/**
 * 播放简短庆祝音效：C5-E5-G5-C6 上行琶音 + 结尾 C 大调和弦，约 1.5 秒。
 * 失败时静默降级（无音频环境不影响功能）。
 */
export function playCelebrationJingle() {
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
