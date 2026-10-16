import { z } from "zod";
import { getRules, resetRules, saveRules } from "@/lib/db";
import { json } from "@/lib/session";

const Body = z.object({
  response: z.string().max(20000),
  mood: z.string().max(20000),
  abnormal: z.string().max(20000),
  block: z.string().max(20000),
  settings: z.object({
    maxWarnings: z.coerce.number().int().min(1).max(100),
    maxMessagesPerMinute: z.coerce.number().int().min(1).max(1000),
    maxMessageLength: z.coerce.number().int().min(50).max(10000),
    warningMessage: z.string().max(2000),
    blockedMessage: z.string().max(2000),
  }),
});

export async function GET() {
  return json({ rules: await getRules() });
}

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "입력값을 확인해 주세요: " + parsed.error.issues[0]?.message }, 400);
  return json({ rules: await saveRules(parsed.data) });
}

/** 기본 규칙으로 되돌리기 */
export async function DELETE() {
  await resetRules();
  return json({ rules: await getRules() });
}
