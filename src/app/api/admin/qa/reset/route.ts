import { listQA, resetQA } from "@/lib/db";
import { json } from "@/lib/session";

export async function POST() {
  await resetQA();
  return json({ qa: await listQA() });
}
