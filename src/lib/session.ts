import { cookies } from "next/headers";
import { USER_COOKIE, sign, verify } from "./auth";
import { findOrCreateUser, getUser } from "./db";
import type { User } from "./types";

/**
 * 고객 로그인 쿠키에는 "아이디 + 이름 + 이메일"을 서명해서 넣어 둡니다.
 * 그래서 저장소에서 사용자를 못 찾더라도(예: Redis 연결 전) 쿠키만으로 다시 만들 수 있어요.
 */
export async function userCookieValue(u: Pick<User, "id" | "name" | "email">) {
  const info = Buffer.from(JSON.stringify({ n: u.name, e: u.email })).toString("base64url");
  return sign(`${u.id}~${info}`);
}

/** 지금 접속한 고객 (쿠키로 확인) */
export async function currentUser(): Promise<User | null> {
  const value = await verify((await cookies()).get(USER_COOKIE)?.value);
  if (!value) return null;
  const [id, info] = value.split("~");
  const found = await getUser(id);
  if (found || !info) return found;
  try {
    const { n, e } = JSON.parse(Buffer.from(info, "base64url").toString("utf8")) as { n: string; e: string };
    return await findOrCreateUser(n, e, id);
  } catch {
    return null;
  }
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });
