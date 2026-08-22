import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import HomePage from "./pages/HomePage";
import LearnPage from "./pages/LearnPage";
import UserSelectPage from "./pages/UserSelectPage";
import RegisterPage from "./pages/RegisterPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import DifficultWordsPage from "./pages/DifficultWordsPage";
import SettingsPage from "./pages/SettingsPage";
import { getAllEntries, getCurriculum } from "./data/curriculum";
import { prefetchAudio } from "./lib/audio";
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

  // 全局键盘避让：手机弹出软键盘时把 --kb-h 写到根元素，
  // 各页面（学习页/密码弹窗等）用它压缩高度，内容始终在键盘上方可见。
  // iOS Safari/WKWebView 键盘弹出时窗口高度不变、键盘直接盖住页面，
  // 必须用 visualViewport 计算；桌面端无键盘，kb 恒为 0，不影响布局。
  useEffect(() => {
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

  // 原生 App：隐藏 iOS 键盘上方的"上下箭头"工具栏（Keyboard Accessory Bar）。
  // 该栏是 WKWebView 自带的表单导航条，唯一的密码/拼写输入框用不上它，
  // 反而占约 44px 高度遮挡输入区。Web 端无此栏，不做任何事。
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    import("@capacitor/keyboard")
      .then(({ Keyboard }) =>
        Keyboard.setAccessoryBarVisible({ isVisible: false })
      )
      .catch(() => {
        /* 插件不可用时静默忽略 */
      });
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
          let ei =
            saved.entryIndex >= 0 && saved.entryIndex < order.length
              ? saved.entryIndex
              : 0;
          // 跳过已完成的题目（答对后未切题就退出 / 单元已学完的场景）
          while (ei < order.length && progress.completedEntryIds.includes(order[ei])) {
            ei += 1;
          }
          // 本单元全部完成 → 从头复习
          entryIndex = ei >= order.length ? 0 : ei;
        } else {
          // 该年级没有学习记录，从第一单元开始
          target = unitIndex;
          order = makeUnitOrder(target, version);
          entryIndex = 0;
        }
      } else {
        // 「继续学习」：从全局指针（上次学习位置）继续
        target = progress.unitIndex;
        order = progress.unitOrder;
        entryIndex = progress.entryIndex;
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
