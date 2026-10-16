import { deleteQA, upsertQA } from "@/lib/db";
import { json } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!b.question?.trim() || !b.answer?.trim()) return json({ error: "질문과 답변을 모두 입력해 주세요." }, 400);
  const item = await upsertQA({ id, category: b.category, question: b.question, answer: b.answer, product: b.product });
  return json({ item });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  await deleteQA(id);
  return json({ ok: true });
}
