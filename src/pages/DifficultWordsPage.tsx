import { useMemo, useState, useRef } from "react";
import {
  getCurriculum,
  gradeLabel,
  getAllEntries,
  type CurriculumVersion,
} from "../data/curriculum";
import type { Progress } from "../lib/progress";
import { resolveAudio } from "../lib/audio";
import type { Accent } from "../lib/users";

interface DifficultWordsPageProps {
  progress: Progress;
  version: CurriculumVersion;
  accent: Accent;
  onBack: () => void;
  onRemove: (entryId: string) => void;
  onStartLearning: () => void;
}

export default function DifficultWordsPage({
  progress,
  version,
  accent,
  onBack,
  onRemove,
  onStartLearning,
}: DifficultWordsPageProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cur = getCurriculum(version);

  const difficultEntries = useMemo(() => {
    const allMap = new Map(getAllEntries(version).map((e) => [e.id, e]));
    // difficultEntryIds 按加入先后追加（新的在末尾），倒序展示 = 最近加入的排最前
    return progress.difficultEntryIds
      .slice()
      .reverse()
      .map((id) => allMap.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e);
  }, [progress.difficultEntryIds, version]);

  const playAudio = async (english: string, entryId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(entryId);

    const result = await resolveAudio(english, accent);
    const fallbackSpeak = () => {
      const u = new SpeechSynthesisUtterance(english);
      u.lang = accent === "uk" ? "en-GB" : "en-US";
      u.rate = 0.9;
      u.onend = () => setPlayingId(null);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    };
    if (result) {
      const audio = new Audio(result.url);
      audio.playbackRate = 0.9;
      audio.onended = () => setPlayingId(null);
      audio.onerror = fallbackSpeak;
      audioRef.current = audio;
      audio.play().catch(fallbackSpeak);
    } else {
      fallbackSpeak();
    }
  };

  return (
    <div className="h-full overflow-y-auto px-5 pb-10">
      <div className="flex items-center gap-3 pt-8">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text2 transition-colors active:bg-primary-lighter"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold text-text">重点记忆</h1>
          <p className="text-[11px] text-text3">{difficultEntries.length} 个待复习词条</p>
        </div>
      </div>

      {difficultEntries.length === 0 ? (
        <div className="mt-24 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-light">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="text-sm text-text2">
            还没有需要重点记忆的内容
            <br />
            学习时点击「我不会」即可添加
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={onStartLearning}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(83,74,183,0.35)] transition-transform active:scale-[0.98]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
            开始学习重点记忆
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
              {difficultEntries.length} 词
            </span>
          </button>
          {difficultEntries.map((entry) => {
            const unit = cur.find(
              (u) => u.grade === entry.grade && u.unit === entry.unit
            );
            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-base font-semibold text-text">
                        {entry.english}
                      </span>
                      {entry.phonetic && (
                        <span className="text-xs text-primary">{entry.phonetic}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-text2">{entry.chinese}</p>
                    <p className="mt-1 text-[11px] text-text3">
                      {gradeLabel(entry.grade)}
                      {unit ? ` · ${unit.title}` : ""} ·{" "}
                      {entry.type === "word"
                        ? "单词"
                        : entry.type === "phrase"
                        ? "短语"
                        : "句子"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => playAudio(entry.english, entry.id)}
                      className="flex h-8 w-14 items-center justify-center rounded-full border border-border bg-white text-text2 transition-colors active:bg-primary-lighter"
                    >
                      {playingId === entry.id ? (
                        /* 播放中：声波律动动画（waveBar，与学习页波浪一致） */
                        <span className="flex h-4 w-4 items-end justify-center gap-[2px]">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className="w-[3px] rounded-full"
                              style={{
                                height: "100%",
                                backgroundColor: "#534AB7",
                                transformOrigin: "bottom",
                                animation: `waveBar .9s ease-in-out ${
                                  i * 0.12
                                }s infinite alternate`,
                              }}
                            />
                          ))}
                        </span>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 5L6 9H2v6h4l5 4V5z" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(entry.id)}
                      className="flex h-8 w-14 items-center justify-center rounded-full border border-error/20 bg-error-light text-xs font-semibold text-error transition-colors active:bg-error/10"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
