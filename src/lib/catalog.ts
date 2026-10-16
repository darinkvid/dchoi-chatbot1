/**
 * data/dchoi09_전집.xlsx 엑셀 파일을 읽어서 상품 목록과 기본 질의응답을 꺼냅니다.
 * 엑셀을 고친 뒤 GitHub에 올리면 챗봇이 새 내용을 알게 됩니다.
 */
import ExcelJS from "exceljs";
import path from "node:path";
import type { Product, QAItem } from "./types";

export const EXCEL_PATH = path.join(process.cwd(), "data", "dchoi09_전집.xlsx");

const PRODUCT_COLUMNS: Record<string, keyof Product> = {
  상품ID: "id",
  상품명: "title",
  브랜드: "brand",
  분류: "categories",
  "연령 카테고리": "ageGroups",
  "권장 연령": "age",
  구성: "composition",
  "배송 가격($)": "shippingPrice",
  "배송 정가($)": "shippingListPrice",
  "픽업 가격($)": "pickupPrice",
  "픽업 정가($)": "pickupListPrice",
  "옵션별 가격": "options",
  판매상태: "available",
  "할인/이벤트": "badges",
  태그: "tags",
  "상세 설명(텍스트)": "description",
  "추가 정보": "extraInfo",
  "상품 URL": "url",
  "대표 이미지": "image",
};

const NUMBER_FIELDS = new Set<keyof Product>(["shippingPrice", "shippingListPrice", "pickupPrice", "pickupListPrice"]);

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return String(v.result ?? "");
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

function readSheet(ws: ExcelJS.Worksheet): Record<string, string>[] {
  const headers: string[] = [];
  ws.getRow(1).eachCell((c, col) => (headers[col] = cellText(c.value).trim()));
  const rows: Record<string, string>[] = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const obj: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (c, col) => {
      if (headers[col]) obj[headers[col]] = cellText(c.value).trim();
    });
    if (Object.values(obj).some(Boolean)) rows.push(obj);
  });
  return rows;
}

let cache: Promise<{ products: Product[]; qa: Omit<QAItem, "id" | "updatedAt">[] }> | null = null;

export function loadCatalog() {
  cache ??= (async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(EXCEL_PATH);
    const productSheet = wb.getWorksheet("전집 상품");
    const qaSheet = wb.getWorksheet("질의응답");
    if (!productSheet || !qaSheet) throw new Error("엑셀에 '전집 상품' 또는 '질의응답' 시트가 없습니다.");

    const products = readSheet(productSheet).map((r) => {
      const p = {} as Record<keyof Product, string | number | null>;
      for (const [header, key] of Object.entries(PRODUCT_COLUMNS)) {
        const raw = r[header] ?? "";
        p[key] = NUMBER_FIELDS.has(key) ? (raw === "" ? null : Number(raw)) : raw;
      }
      return p as Product;
    });

    const qa = readSheet(qaSheet)
      .map((r) => ({ category: r["분류"] ?? "", question: r["질문"] ?? "", answer: r["답변"] ?? "", product: r["관련 상품"] ?? "" }))
      .filter((q) => q.question && q.answer);

    return { products, qa };
  })().catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}

/** 챗봇에게 보여줄 상품 목록 텍스트 */
export function productsToPrompt(products: Product[]): string {
  const money = (n: number | null) => (n == null ? "-" : `$${n.toFixed(2)}`);
  return products
    .map((p, i) =>
      [
        `### ${i + 1}. ${p.title}`,
        `- 브랜드: ${p.brand}`,
        p.categories && `- 분류: ${p.categories}`,
        (p.age || p.ageGroups) && `- 연령: ${[p.age, p.ageGroups].filter(Boolean).join(" / ")}`,
        p.composition && `- 구성: ${p.composition}`,
        `- 가격: 배송 ${money(p.shippingPrice)}${p.shippingListPrice ? ` (정가 ${money(p.shippingListPrice)})` : ""}` +
          (p.pickupPrice != null ? `, 남가주 픽업 ${money(p.pickupPrice)}` : ""),
        `- 판매상태: ${p.available}`,
        p.badges && `- 이벤트: ${p.badges}`,
        p.tags && `- 태그: ${p.tags}`,
        p.description && `- 상세 설명: ${p.description.replace(/\n+/g, " ").slice(0, 1500)}`,
        `- 링크: ${p.url}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
