import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import HomePage from "./pages/HomePage";
import LearnPage from "./pages/LearnPage";
import UserSelectPage from "./pages/UserSelectPage";
import RegisterPage from "./pages/RegisterPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import DifficultWordsPage from "./pages/DifficultWordsPage";
import SettingsPage from "./pages/SettingsPage";
import { getAllEntries, getCurriculum } from "./data/curriculum";
import { prefetchAudio } from "./lib/audio";
import { flushStorage } from "./lib/storage";
import { primeSpeech } from "./hooks/useSpeechLoop";
import {
  type Progress,
  freshProgress,
  loadProgress,
  makeUnitOrder,
  resetProgress,
  saveProgress,
  shuffle,
} from "./lib/progress";
import {
  type User,
  type UserConfig,
  loadUsers,
  registerUser,
  saveUsers,
  updateUserConfig,
} from "./lib/users";

type View =
  | "select"
  | "register"
  | "home"
  | "learn"
  | "leaderboard"
  | "difficult"
  | "settings";
type LearnMode = "normal" | "difficult";

export default function App() {
  const [view, setView] = useState<View>("select");
  const [users, setUsers] = useState<User[]>(() => loadUsers());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [progress, setProgressState] = useState<Progress | null>(null);
  // 学习模式：difficult = 重点记忆学习（随机遍历难词列表）
  const [learnMode, setLearnMode] = useState<LearnMode>("normal");
  const [difficultOrder, setDifficultOrder] = useState<string[]>([]);

  // 当前用户的教材版本（进度按版本隔离加载）
  const version = currentUser?.config.curriculum ?? "renjiao";
  const accent = currentUser?.config.accent ?? "us";
  const cur = getCurriculum(version);

  // 启动即预热浏览器语音引擎，消除首次发音的冷启动延迟
  useEffect(() => {
    primeSpeech();
  }, []);

  // 全局键盘避让：iOS 原生 App 用 Capacitor Keyboard 事件直接取键盘高度；
  // 桌面浏览器用 visualViewport 兜底。把 --kb-h 写到根元素，
  // 各页面用它调整底部内边距，保证"我不会"等底部按钮不被键盘挡住。
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let showListener: { remove: () => void } | undefined;
      let hideListener: { remove: () => void } | undefined;
      const setup = async () => {
        await Keyboard.setAccessoryBarVisible({ isVisible: false });
        showListener = await Keyboard.addListener(
          "keyboardWillShow",
          ({ keyboardHeight }) => {
            document.documentElement.style.setProperty(
              "--kb-h",
              `${keyboardHeight}px`
            );
          }
        );
        hideListener = await Keyboard.addListener("keyboardWillHide", () => {
          document.documentElement.style.setProperty("--kb-h", "0px");
        });
      };
      setup().catch(() => {});
      return () => {
        showListener?.remove();
        hideListener?.remove();
        document.documentElement.style.setProperty("--kb-h", "0px");
      };
    }

    // Web 端兜底：visualViewport 计算
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty(
        "--kb-h",
        kb > 60 ? `${Math.round(kb)}px` : "0px"
      );
    };
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    apply();
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      document.documentElement.style.setProperty("--kb-h", "0px");
    };
  }, []);

  // App 切后台或页面隐藏时，确保最后一次进度写入已落到原生 Preferences。
  // 单靠 localStorage 在 iOS 后台被杀时可能丢末尾写入；flush 能显著降低
  // entryIndex / 完成状态在下次启动时回退的概率。
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushStorage().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const commitUsers = useCallback((next: User[]) => {
    setUsers(next);
    saveUsers(next);
  }, []);

  /** 登录：加载该用户独立的学习进度（按教材版本隔离） */
  const handleLogin = useCallback((user: User) => {
    setCurrentUser(user);
    setProgressState(loadProgress(user.id, user.config.curriculum));
    setView("home");
  }, []);

  /** 注册成功后自动登录 */
  const handleRegister = useCallback(
    (avatarId: string, password: string) => {
      const result = registerUser(users, avatarId, password);
      if (result.ok && result.user) {
        commitUsers([...users, result.user]);
        handleLogin(result.user);
      }
      return result;
    },
    [users, commitUsers, handleLogin]
  );

  /** 设置页保存：更新当前用户的教材/口音配置，并切换到对应版本的进度 */
  const handleSaveConfig = useCallback(
    (config: UserConfig) => {
      if (!currentUser) return;
      const nextUsers = updateUserConfig(users, currentUser.id, config);
      commitUsers(nextUsers);
      const updated = nextUsers.find((u) => u.id === currentUser.id);
      if (updated) setCurrentUser(updated);
      // 重新加载目标版本的进度（各版本进度独立保存）
      setProgressState(loadProgress(currentUser.id, config.curriculum));
    },
    [users, currentUser, commitUsers]
  );

  /** 答题得分：更新用户积分与已学数量 */
  const addPoints = useCallback(
    (userId: string, points: number, learnedDelta: number) => {
      setUsers((prev) => {
        const next = prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                points: u.points + points,
                learnedCount: u.learnedCount + learnedDelta,
              }
            : u
        );
        saveUsers(next);
        setCurrentUser((cur) =>
          cur && cur.id === userId
            ? next.find((u) => u.id === userId) ?? cur
            : cur
        );
        return next;
      });
    },
    []
  );

  const setProgress = useCallback(
    (updater: Progress | ((prev: Progress) => Progress)) => {
      setProgressState((prev) => {
        if (!prev || !currentUser) return prev;
        const next = typeof updater === "function" ? updater(prev) : updater;
        saveProgress(currentUser.id, next);
        return next;
      });
    },
    [currentUser]
  );

  const startLearning = useCallback(
    (unitIndex?: number) => {
      if (!progress || !currentUser) return;

      // 给定单元顺序，返回第一个未完成的题目下标；全部完成返回 order.length
      const firstUnfinished = (order: string[]) => {
        let i = 0;
        while (
          i < order.length &&
          progress.completedEntryIds.includes(order[i])
        ) {
          i += 1;
        }
        return i;
      };

      // 从指定单元开始向后查找，返回第一个有未学题目的单元及其顺序、下标。
      // 如果所有单元都学完，返回起始单元及其顺序、下标 0（从头复习）。
      const findNextUnfinishedUnit = (
        startUnitIndex: number
      ): { target: number; order: string[]; entryIndex: number } => {
        for (let ui = startUnitIndex; ui < cur.length; ui += 1) {
          const order =
            ui === progress.unitIndex ? progress.unitOrder : makeUnitOrder(ui, version);
          const ei = firstUnfinished(order);
          if (ei < order.length) {
            return { target: ui, order, entryIndex: ei };
          }
        }
        // 全部完成：回到起始单元从头复习
        const order =
          startUnitIndex === progress.unitIndex
            ? progress.unitOrder
            : makeUnitOrder(startUnitIndex, version);
        return { target: startUnitIndex, order, entryIndex: 0 };
      };

      let target: number;
      let entryIndex: number;
      let order: string[];

      if (unitIndex !== undefined) {
        // 点击年级卡片：优先恢复该年级上次保存的学习位置
        const grade = cur[unitIndex]?.grade;
        const saved =
          grade != null ? progress.gradeProgress?.[String(grade)] : undefined;
        if (saved && cur[saved.unitIndex]?.grade === grade) {
          target = saved.unitIndex;
          order =
            saved.unitOrder?.length
              ? saved.unitOrder
              : makeUnitOrder(saved.unitIndex, version);
          entryIndex = firstUnfinished(order);
          // 该保存位置已全部完成 → 从该单元往后找下一个未学单元
          if (entryIndex >= order.length) {
            const next = findNextUnfinishedUnit(target);
            target = next.target;
            order = next.order;
            entryIndex = next.entryIndex;
          }
        } else {
          // 该年级没有学习记录，从第一单元开始
          const next = findNextUnfinishedUnit(unitIndex);
          target = next.target;
          order = next.order;
          entryIndex = next.entryIndex;
        }
      } else {
        // 「继续学习」：从全局指针继续；若当前单元已学完则自动往后找
        const next = findNextUnfinishedUnit(progress.unitIndex);
        target = next.target;
        order = next.order;
        entryIndex = next.entryIndex;
      }

      // 进入学习前预取第一题的真人音频，页面切过去时零等待
      const firstId = order[entryIndex] ?? order[0];
      const firstEntry = cur[target]?.entries.find((e) => e.id === firstId);
      if (firstEntry) prefetchAudio(firstEntry.english, accent);

      setProgress((prev) => ({
        ...prev,
        unitIndex: target,
        entryIndex,
        unitOrder: order,
      }));
      setView("learn");
    },
    [progress, currentUser, version, accent, cur, setProgress]
  );

  /** 开始重点记忆学习：随机打乱难词列表，逐词学习一遍 */
  const startDifficultLearning = useCallback(() => {
    if (!progress || !currentUser) return;
    const ids = shuffle(progress.difficultEntryIds);
    if (ids.length === 0) return;
    setDifficultOrder(ids);
    setLearnMode("difficult");
    setView("learn");
    // 预取第一题的真人音频
    const allMap = new Map(getAllEntries(version).map((e) => [e.id, e]));
    const first = allMap.get(ids[0]);
    if (first) prefetchAudio(first.english, accent);
  }, [progress, currentUser, version, accent]);

  /** 退出学习页：难词模式回重点记忆页，普通模式回首页 */
  const exitLearn = useCallback(() => {
    setView(learnMode === "difficult" ? "difficult" : "home");
    setLearnMode("normal");
    setDifficultOrder([]);
  }, [learnMode]);

  // iOS 左缘右滑返回手势。系统级的边缘返回属于 UINavigationController，
  // Capacitor 应用只有一个 ViewController（无导航栈），系统手势天然无效，
  // 因此在 Web 层模拟：从屏幕左缘（28px 内）起手、右滑超过 55px 且垂直
  // 位移小，视为"返回"——学习页回首页，其余子页面回各自上级。
  useEffect(() => {
    const goBack = () => {
      switch (view) {
        case "learn":
          exitLearn();
          break;
        case "difficult":
        case "settings":
          setView("home");
          break;
        case "leaderboard":
          setView(currentUser ? "home" : "select");
          break;
        case "register":
          setView("select");
          break;
        default:
          break;
      }
    };
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const EDGE = 28; // 左缘判定宽度
    const THRESHOLD = 55; // 右滑触发距离
    const MAX_DY = 45; // 允许的最大垂直位移
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && t.clientX <= EDGE) {
        tracking = true;
        startX = t.clientX;
        startY = t.clientY;
      } else {
        tracking = false;
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (dx > THRESHOLD && Math.abs(dy) < MAX_DY) goBack();
    };
    const onCancel = () => {
      tracking = false;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [view, currentUser, exitLearn]);

  /** 清空当前用户在该教材下的学习进度，积分与已学数量一并清零 */
  const handleReset = useCallback(() => {
    if (!currentUser) return;
    resetProgress(currentUser.id, version);
    const fresh = freshProgress(version);
    setProgressState(fresh);
    saveProgress(currentUser.id, fresh);
    // 积分与已学数量一并清零
    const nextUsers = users.map((u) =>
      u.id === currentUser.id ? { ...u, points: 0, learnedCount: 0 } : u
    );
    commitUsers(nextUsers);
    setCurrentUser((cur) =>
      cur ? nextUsers.find((u) => u.id === cur.id) ?? cur : cur
    );
  }, [currentUser, version, users, commitUsers]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setProgressState(null);
    setView("select");
  }, []);

  /** 从重点记忆中移除 */
  const removeDifficult = useCallback(
    (entryId: string) => {
      setProgress((prev) => ({
        ...prev,
        difficultEntryIds: prev.difficultEntryIds.filter(
          (id) => id !== entryId
        ),
      }));
    },
    [setProgress]
  );

  return (
    <div className="mx-auto h-full max-w-md bg-bg shadow-sm">
      {view === "select" && (
        <UserSelectPage
          users={users}
          onLogin={handleLogin}
          onRegister={() => setView("register")}
          onLeaderboard={() => setView("leaderboard")}
        />
      )}

      {view === "register" && (
        <RegisterPage
          users={users}
          onRegister={handleRegister}
          onBack={() => setView("select")}
        />
      )}

      {view === "leaderboard" && (
        <LeaderboardPage
          users={users}
          currentUserId={currentUser?.id ?? null}
          onBack={() => setView(currentUser ? "home" : "select")}
        />
      )}

      {view === "settings" && currentUser && (
        <SettingsPage
          user={currentUser}
          onBack={() => setView("home")}
          onSave={handleSaveConfig}
        />
      )}

      {view === "home" && currentUser && progress && (
        <HomePage
          user={currentUser}
          progress={progress}
          version={version}
          onStart={startLearning}
          onReset={handleReset}
          onLogout={handleLogout}
          onLeaderboard={() => setView("leaderboard")}
          onDifficultWords={() => setView("difficult")}
          onSettings={() => setView("settings")}
        />
      )}

      {view === "difficult" && currentUser && progress && (
        <DifficultWordsPage
          progress={progress}
          version={version}
          accent={accent}
          onBack={() => setView("home")}
          onRemove={removeDifficult}
          onStartLearning={startDifficultLearning}
        />
      )}

      {view === "learn" && currentUser && progress && (
        <LearnPage
          progress={progress}
          setProgress={setProgress}
          user={currentUser}
          version={version}
          addPoints={addPoints}
          onExit={exitLearn}
          onRestart={handleReset}
          difficultMode={learnMode === "difficult"}
          difficultOrder={difficultOrder}
        />
      )}
    </div>
  );
}
