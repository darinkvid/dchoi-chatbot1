import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminToken, cookieOptions } from "@/lib/auth";
import { json } from "@/lib/session";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!process.env.ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD 환경변수가 설정되지 않았어요." }, 500);
  if (password !== process.env.ADMIN_PASSWORD) {
    await new Promise((r) => setTimeout(r, 800));
    return json({ error: "비밀번호가 맞지 않아요." }, 401);
  }
  (await cookies()).set(ADMIN_COOKIE, await adminToken(), { ...cookieOptions, maxAge: 60 * 60 * 12 });
  return json({ ok: true });
}
