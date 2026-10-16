/**
 * 쿠키 서명(위조 방지). 서버와 미들웨어 모두에서 동작하도록 Web Crypto를 씁니다.
 */
export const USER_COOKIE = "dchoi_uid";
export const ADMIN_COOKIE = "dchoi_admin";

function secret() {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("SESSION_SECRET 환경변수가 없습니다.");
  return s;
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sign(value: string) {
  return `${value}.${await hmac(value)}`;
}

export async function verify(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const value = token.slice(0, i);
  return safeEqual(token.slice(i + 1), await hmac(value)) ? value : null;
}

/** 운영자 쿠키 값: 비밀번호가 바뀌면 기존 로그인은 자동으로 풀립니다. */
export async function adminToken() {
  return sign(`admin:${(await hmac(`pw:${process.env.ADMIN_PASSWORD ?? ""}`)).slice(0, 16)}`);
}

export async function isAdminToken(token: string | undefined) {
  if (!token || !process.env.ADMIN_PASSWORD) return false;
  return safeEqual(token, await adminToken());
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
