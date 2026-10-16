import { deleteUser, getMessages, getUser, saveUser } from "@/lib/db";
import { json } from "@/lib/session";
import type { UserStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) return json({ error: "사용자를 찾을 수 없어요." }, 404);
  return json({ user, messages: await getMessages(id, 1000) });
}

/** 상태 변경: { status: "active" | "warned" | "blocked", resetWarnings?: boolean } */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) return json({ error: "사용자를 찾을 수 없어요." }, 404);
  const body = (await req.json().catch(() => ({}))) as { status?: UserStatus; resetWarnings?: boolean };
  if (body.status && ["active", "warned", "blocked"].includes(body.status)) user.status = body.status;
  if (body.resetWarnings) user.warnings = 0;
  await saveUser(user);
  return json({ user });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  await deleteUser(id);
  return json({ ok: true });
}
