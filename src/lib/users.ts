// 多用户系统：头像库 + 用户注册/登录 + 积分（单机版，localStorage 存储）

import type { CurriculumVersion } from "../data/curriculum";
import { storageGet, storageSet } from "./storage";

export type Accent = "us" | "uk";

/** 每个用户独立的教材与口音配置 */
export interface UserConfig {
  curriculum: CurriculumVersion;
  accent: Accent;
  /** 答对后是否自动进入下一题（默认 false：需手动按空格 / 点按钮） */
  autoNext?: boolean;
}

export const DEFAULT_CONFIG: UserConfig = {
  curriculum: "waiyanshe",
  accent: "uk",
  autoNext: false,
};

export interface AvatarDef {
  id: string;
  emoji: string;
  name: string;
  color: string; // 头像底色（柔和渐变起点）
}

export interface User {
  id: string;
  avatarId: string;
  password: string; // 4 位数字
  points: number;
  learnedCount: number; // 已学条目数
  createdAt: number;
  config: UserConfig; // 教材版本 + 口音（每个用户独立）
}

/** 16 个卡通头像，单机版每个头像只能被一个用户占用 */
export const AVATARS: AvatarDef[] = [
  { id: "dog", emoji: "🐶", name: "小狗", color: "#FFE3C2" },
  { id: "cat", emoji: "🐱", name: "猫咪", color: "#FFDFE3" },
  { id: "panda", emoji: "🐼", name: "熊猫", color: "#E8E6E0" },
  { id: "fox", emoji: "🦊", name: "狐狸", color: "#FFE0CF" },
  { id: "lion", emoji: "🦁", name: "狮子", color: "#FFE9B8" },
  { id: "frog", emoji: "🐸", name: "青蛙", color: "#DCF2DC" },
  { id: "octopus", emoji: "🐙", name: "章鱼", color: "#E3E7FF" },
  { id: "unicorn", emoji: "🦄", name: "独角兽", color: "#F3E3FF" },
  { id: "tiger", emoji: "🐯", name: "老虎", color: "#FFE6D2" },
  { id: "monkey", emoji: "🐵", name: "猴子", color: "#FFEBC7" },
  { id: "pig", emoji: "🐷", name: "小猪", color: "#FFDCE8" },
  { id: "rabbit", emoji: "🐰", name: "兔子", color: "#FFF0D6" },
  { id: "bear", emoji: "🐻", name: "小熊", color: "#F0DFC9" },
  { id: "penguin", emoji: "🐧", name: "企鹅", color: "#D9EEF7" },
  { id: "chick", emoji: "🐤", name: "小鸡", color: "#FFF4C2" },
  { id: "dragon", emoji: "🐲", name: "小龙", color: "#D6F0E3" },
];

const USERS_KEY = "eng-learning-users-v1";

export function avatarById(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

export function loadUsers(): User[] {
  try {
    const raw = storageGet(USERS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        // 兼容旧数据：老用户没有 config 字段，补默认配置
        return list.map((u) => ({
          ...u,
          config: { ...DEFAULT_CONFIG, ...(u.config ?? {}) },
        })) as User[];
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveUsers(users: User[]) {
  storageSet(USERS_KEY, JSON.stringify(users));
}

/** 更新指定用户的教材/口音配置（返回新数组，调用方负责持久化） */
export function updateUserConfig(
  users: User[],
  userId: string,
  patch: Partial<UserConfig>
): User[] {
  return users.map((u) =>
    u.id === userId ? { ...u, config: { ...u.config, ...patch } } : u
  );
}

export function takenAvatarIds(users: User[]): Set<string> {
  return new Set(users.map((u) => u.avatarId));
}

/** 学习条目完成可获得的积分 */
export function pointsForEntry(type: "word" | "phrase" | "sentence"): number {
  if (type === "sentence") return 10;
  if (type === "phrase") return 8;
  return 5;
}

export interface RegisterResult {
  ok: boolean;
  user?: User;
  error?: string;
}

export function registerUser(
  users: User[],
  avatarId: string,
  password: string
): RegisterResult {
  if (!AVATARS.some((a) => a.id === avatarId)) {
    return { ok: false, error: "请先选择一个头像" };
  }
  if (takenAvatarIds(users).has(avatarId)) {
    return { ok: false, error: "这个头像已经被选走了，换一个吧" };
  }
  if (!/^\d{4}$/.test(password)) {
    return { ok: false, error: "密码必须是 4 位数字" };
  }
  const user: User = {
    id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    avatarId,
    password,
    points: 0,
    learnedCount: 0,
    createdAt: Date.now(),
    config: { ...DEFAULT_CONFIG },
  };
  return { ok: true, user };
}
