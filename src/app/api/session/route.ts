import { cookies } from "next/headers";
import { z } from "zod";
import { USER_COOKIE, cookieOptions, sign } from "@/lib/auth";
import { findOrCreateUser } from "@/lib/db";
import { currentUser, json } from "@/lib/session";

const Body = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(40),
  email: z.string().trim().email("이메일 주소를 확인해 주세요.").max(120),
});

export async function GET() {
  const u = await currentUser();
  return json({ user: u ? { name: u.name, email: u.email, status: u.status } : null });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." }, 400);
  const user = await findOrCreateUser(parsed.data.name, parsed.data.email);
  (await cookies()).set(USER_COOKIE, await sign(user.id), cookieOptions);
  return json({ user: { name: user.name, email: user.email, status: user.status } });
}

export async function DELETE() {
  (await cookies()).delete(USER_COOKIE);
  return json({ ok: true });
}
