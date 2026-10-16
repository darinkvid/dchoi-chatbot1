/**
 * 데이터 저장소.
 * - Vercel에 Upstash Redis를 연결하면 → Redis에 저장 (영구 보관)
 * - 내 컴퓨터에서 테스트할 때 → .data/db.json 파일에 저장
 */
import { Redis } from "@upstash/redis";
import fs from "node:fs";
import path from "node:path";

interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  hgetall<T>(key: string): Promise<Record<string, T>>;
  hdel(key: string, field: string): Promise<void>;
  rpush(key: string, value: unknown): Promise<void>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;
}

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

function redisKV(redis: Redis): KV {
  return {
    get: (k) => redis.get(k),
    set: async (k, v) => void (await redis.set(k, v)),
    del: async (k) => void (await redis.del(k)),
    hget: (k, f) => redis.hget(k, f),
    hset: async (k, f, v) => void (await redis.hset(k, { [f]: v })),
    hgetall: async <T>(k: string) => ((await redis.hgetall<Record<string, T>>(k)) ?? {}),
    hdel: async (k, f) => void (await redis.hdel(k, f)),
    rpush: async (k, v) => void (await redis.rpush(k, v)),
    lrange: (k, s, e) => redis.lrange(k, s, e),
  };
}

function fileKV(): KV {
  // Vercel 서버는 프로젝트 폴더에 쓸 수 없어서 임시 폴더(/tmp)를 씁니다 — 금방 지워지니 Redis 연결 필수
  const file = process.env.VERCEL ? "/tmp/dchoi-db.json" : path.join(process.cwd(), ".data", "db.json");
  type DB = Record<string, unknown>;
  const load = (): DB => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {});
  const save = (db: DB) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db, null, 2));
  };
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  return {
    get: async <T>(k: string) => (clone(load()[k]) as T) ?? null,
    set: async (k, v) => {
      const db = load();
      db[k] = v;
      save(db);
    },
    del: async (k) => {
      const db = load();
      delete db[k];
      save(db);
    },
    hget: async <T>(k: string, f: string) => (clone((load()[k] as Record<string, T> | undefined)?.[f]) as T) ?? null,
    hset: async (k, f, v) => {
      const db = load();
      db[k] = { ...((db[k] as object) ?? {}), [f]: v };
      save(db);
    },
    hgetall: async <T>(k: string) => clone((load()[k] as Record<string, T>) ?? {}),
    hdel: async (k, f) => {
      const db = load();
      const h = (db[k] as Record<string, unknown>) ?? {};
      delete h[f];
      db[k] = h;
      save(db);
    },
    rpush: async (k, v) => {
      const db = load();
      db[k] = [...((db[k] as unknown[]) ?? []), v];
      save(db);
    },
    lrange: async <T>(k: string, s: number, e: number) => {
      const list = ((load()[k] as T[]) ?? []).slice();
      const len = list.length;
      const from = s < 0 ? Math.max(len + s, 0) : s;
      const to = e < 0 ? len + e : Math.min(e, len - 1);
      return clone(list.slice(from, to + 1));
    },
  };
}

if (!redisUrl && process.env.VERCEL) {
  console.warn("⚠️ Upstash Redis가 연결되지 않았습니다. Vercel에서는 데이터가 저장되지 않아요. 안내서 7단계를 확인하세요.");
}

export const kv: KV = redisUrl && redisToken ? redisKV(new Redis({ url: redisUrl, token: redisToken })) : fileKV();
export const storageMode = redisUrl && redisToken ? "redis" : "file";
