import { askClaude } from "@/lib/claude";
import { addMessage, getMessages, getRules, listQA, saveUser } from "@/lib/db";
import { currentUser, json } from "@/lib/session";
import type { ChatMessage, User } from "@/lib/types";

export const maxDuration = 60;

const publicView = (m: ChatMessage) => ({ role: m.role, content: m.content, ts: m.ts, notice: m.notice });

export async function GET() {
  const user = await currentUser();
  if (!user) return json({ error: "로그인이 필요해요." }, 401);
  const messages = await getMessages(user.id, 200);
  return json({ messages: messages.map(publicView), status: user.status });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return json({ error: "로그인이 필요해요." }, 401);
  const rules = await getRules();
  const { settings } = rules;

  if (user.status === "blocked") return json({ blocked: true, reply: settings.blockedMessage, status: user.status });

  const body = (await req.json().catch(() => ({}))) as { message?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return json({ error: "메시지를 입력해 주세요." }, 400);
  if (message.length > settings.maxMessageLength)
    return json({ error: `메시지는 ${settings.maxMessageLength}자까지 보낼 수 있어요.` }, 400);

  const history = await getMessages(user.id, 60);

  // 너무 빠르게 많이 보내는지 확인 (이상 사용자 규칙)
  const oneMinuteAgo = Date.now() - 60_000;
  const recentCount = history.filter((m) => m.role === "user" && Date.parse(m.ts) > oneMinuteAgo).length;
  const tooFast = recentCount >= settings.maxMessagesPerMinute;

  let result;
  try {
    result = await askClaude({ user, history, message, rules, qa: await listQA() });
  } catch (e) {
    console.error("Claude 호출 실패:", e);
    return json({ error: "챗봇이 잠시 응답하지 못했어요. 잠시 후 다시 시도해 주세요." }, 502);
  }

  let abuse = result.abuse_level;
  let abuseReason = result.abuse_reason;
  if (tooFast && abuse === "none") {
    abuse = "warn";
    abuseReason = `1분에 ${settings.maxMessagesPerMinute}개 이상 메시지 전송`;
  }

  const ts = new Date().toISOString();
  const updated: User = {
    ...user,
    lastSeenAt: ts,
    lastMood: result.mood,
    messageCount: user.messageCount + 1,
    lastMessage: message.slice(0, 120),
  };
  let notice: ChatMessage["notice"];
  if (abuse === "warn") {
    updated.warnings += 1;
    updated.status = updated.warnings >= settings.maxWarnings ? "blocked" : "warned";
    notice = updated.status === "blocked" ? "blocked" : "warning";
  } else if (abuse === "block") {
    updated.status = "blocked";
    notice = "blocked";
  }

  await addMessage(user.id, { role: "user", content: message, ts, mood: result.mood, moodReason: result.mood_reason, abuse, abuseReason });
  await addMessage(user.id, { role: "assistant", content: result.reply, ts: new Date().toISOString() });
  if (notice) {
    await addMessage(user.id, {
      role: "assistant",
      content: notice === "blocked" ? settings.blockedMessage : `${settings.warningMessage} (경고 ${updated.warnings}/${settings.maxWarnings})`,
      ts: new Date().toISOString(),
      notice,
    });
  }
  await saveUser(updated);

  const messages = await getMessages(user.id, 200);
  return json({ messages: messages.map(publicView), status: updated.status });
}
