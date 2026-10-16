import { listUsers } from "@/lib/db";
import { storageMode } from "@/lib/store";
import { json } from "@/lib/session";

export async function GET() {
  return json({ users: await listUsers(), storageMode });
}
