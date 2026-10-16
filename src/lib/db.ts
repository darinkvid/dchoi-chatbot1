import { loadCatalog } from "./catalog";
import { DEFAULT_RULES } from "./rules";
import { kv } from "./store";
import type { ChatMessage, QAItem, Rules, User } from "./types";

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

// ── 사용자 ─────────────────────────────────────────

export async function findOrCreateUser(name: string, email: string, preferredId?: string): Promise<User> {
  const key = email.trim().toLowerCase();
  const existingId = await kv.hget<string>("user_by_email", key);
  if (existingId) {
    const u = await getUser(existingId);
    if (u) {
      const updated = { ...u, name: name.trim() || u.name, lastSeenAt: now() };
      await kv.hset("users", u.id, updated);
      return updated;
    }
  }
  const user: User = {
    id: preferredId || newId(),
    name: name.trim(),
    email: key,
    createdAt: now(),
    lastSeenAt: now(),
    status: "active",
    warnings: 0,
    lastMood: "",
    messageCount: 0,
    lastMessage: "",
  };
  await kv.hset("users", user.id, user);
  await kv.hset("user_by_email", key, user.id);
  return user;
}

export const getUser = (id: string) => kv.hget<User>("users", id);
export const saveUser = (u: User) => kv.hset("users", u.id, u);

export async function listUsers(): Promise<User[]> {
  const all = Object.values(await kv.hgetall<User>("users"));
  return all.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export async function deleteUser(id: string) {
  const u = await getUser(id);
  if (!u) return;
  await kv.hdel("users", id);
  await kv.hdel("user_by_email", u.email);
  await kv.del(`conv:${id}`);
}

// ── 대화 기록 ─────────────────────────────────────

export const getMessages = (userId: string, last = 500) => kv.lrange<ChatMessage>(`conv:${userId}`, -last, -1);
export const addMessage = (userId: string, m: ChatMessage) => kv.rpush(`conv:${userId}`, m);

// ── 질의응답 ─────────────────────────────────────

async function seedQA() {
  const { qa } = await loadCatalog();
  for (const q of qa) {
    const item: QAItem = { id: newId(), ...q, updatedAt: now() };
    await kv.hset("qa", item.id, item);
  }
  await kv.set("qa_seeded", now());
}

export async function listQA(): Promise<QAItem[]> {
  if (!(await kv.get("qa_seeded"))) await seedQA();
  const all = Object.values(await kv.hgetall<QAItem>("qa"));
  const order = ["공통", "가격", "구성", "연령"];
  const rank = (c: string) => (order.indexOf(c) === -1 ? -1 : order.indexOf(c));
  return all.sort((a, b) => rank(a.category) - rank(b.category) || a.product.localeCompare(b.product, "ko"));
}

export async function upsertQA(input: Partial<QAItem> & Pick<QAItem, "question" | "answer">): Promise<QAItem> {
  const item: QAItem = {
    id: input.id || newId(),
    category: input.category?.trim() || "기타",
    question: input.question.trim(),
    answer: input.answer.trim(),
    product: input.product?.trim() ?? "",
    updatedAt: now(),
  };
  await kv.hset("qa", item.id, item);
  return item;
}

export const deleteQA = (id: string) => kv.hdel("qa", id);

/** 엑셀 원본 상태로 되돌리기 (운영자가 고친 내용은 사라짐) */
export async function resetQA() {
  await kv.del("qa");
  await seedQA();
}

// ── 규칙 ────────────────────────────────────────

export async function getRules(): Promise<Rules> {
  const saved = await kv.get<Rules>("rules");
  if (!saved) return { ...DEFAULT_RULES, updatedAt: "" };
  return { ...DEFAULT_RULES, ...saved, settings: { ...DEFAULT_RULES.settings, ...saved.settings } };
}

export async function saveRules(r: Omit<Rules, "updatedAt">): Promise<Rules> {
  const rules = { ...r, updatedAt: now() };
  await kv.set("rules", rules);
  return rules;
}

export const resetRules = () => kv.del("rules");
