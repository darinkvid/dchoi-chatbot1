import { listQA, upsertQA } from "@/lib/db";
import { json } from "@/lib/session";

export async function GET() {
  return json({ qa: await listQA() });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!b.question?.trim() || !b.answer?.trim()) return json({ error: "질문과 답변을 모두 입력해 주세요." }, 400);
  const item = await upsertQA({ category: b.category, question: b.question, answer: b.answer, product: b.product });
  return json({ item });
}
