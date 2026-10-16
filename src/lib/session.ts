import { cookies } from "next/headers";
import { USER_COOKIE, verify } from "./auth";
import { getUser } from "./db";

/** 지금 접속한 고객 (쿠키로 확인) */
export async function currentUser() {
  const id = await verify((await cookies()).get(USER_COOKIE)?.value);
  return id ? getUser(id) : null;
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });
