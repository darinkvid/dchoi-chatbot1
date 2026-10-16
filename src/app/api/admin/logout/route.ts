import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/auth";
import { json } from "@/lib/session";

export async function POST() {
  (await cookies()).delete(ADMIN_COOKIE);
  return json({ ok: true });
}
