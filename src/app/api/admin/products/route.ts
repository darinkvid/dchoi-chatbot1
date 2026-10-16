import { loadCatalog } from "@/lib/catalog";
import { json } from "@/lib/session";

export async function GET() {
  const { products } = await loadCatalog();
  return json({ products });
}
