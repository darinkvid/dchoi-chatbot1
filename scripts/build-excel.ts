/**
 * dchoi09.com "전집 All" 카테고리의 모든 상품과 상세페이지를 수집해서
 * data/dchoi09_전집.xlsx 엑셀 파일을 만듭니다.
 *
 * 실행: npm run build-excel
 */
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";

const SITE = "https://dchoi09.com";
const COLLECTION = "series-books-all";
const OUT = path.join(process.cwd(), "data", "dchoi09_전집.xlsx");
const UA = "Mozilla/5.0 (dchoi-chatbot data builder)";

const AGE_COLLECTIONS: Record<string, string> = {
  "전집-0-1-세": "0-1세",
  "전집-1-2-세": "1-2세",
  "전집-2-3세": "2-3세",
  "전집-3-4세": "3-4세",
  "전집-5세-이상": "5세 이상",
};

const SUB_CATEGORIES = [
  "창작동화", "전래/명작", "인성/생활", "명화/예술", "수학/과학", "사회/역사",
  "지식/백과", "언어/인지", "통합발달", "기독교", "단편 도서", "학습", "놀이북",
];

type ShopifyVariant = {
  title: string;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  sku: string | null;
  grams: number;
};

type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
  body_html: string | null;
  published_at: string;
  updated_at: string;
  variants: ShopifyVariant[];
  images: { src: string }[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string): Promise<string> {
  // 사이트에 부담을 주지 않도록 요청 사이에 쉬고, 너무 많다고(429) 하면 더 오래 기다립니다.
  for (let attempt = 1; attempt <= 6; attempt++) {
    await sleep(700);
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      if (attempt === 6) throw e;
      await sleep(5000 * attempt);
      continue;
    }
    if (res.ok) return res.text();
    if (attempt === 6 || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} ${url}`);
    const retryAfter = Number(res.headers.get("retry-after")) || 5 * attempt;
    await sleep(retryAfter * 1000);
  }
  throw new Error("unreachable");
}

async function listCollection(handle: string): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page < 20; page++) {
    const url = `${SITE}/collections/${encodeURIComponent(handle)}/products.json?limit=250&page=${page}`;
    const { products } = JSON.parse(await get(url)) as { products: ShopifyProduct[] };
    if (products.length === 0) break;
    all.push(...products);
  }
  return all;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** 상세페이지 HTML에서 구성/연령 같은 추가 정보와 할인 배지를 뽑아냅니다. */
function parseDetailPage(html: string) {
  const blocks = [...html.matchAll(/<div class="metafield-rich_text_field">([\s\S]*?)<\/div>/g)].map((m) => m[1]);
  const infoText = blocks.map(htmlToText).join("\n").replace("View Product Details", "").trim();
  const linkMatch = blocks.join("").match(/href="([^"]+)"[^>]*>View Product Details/);

  const field = (label: string) => {
    const m = infoText.match(new RegExp(`${label}\\s*[:：]?\\s*([^\\n]+)`));
    return m ? m[1].trim() : "";
  };

  const badges = [
    ...new Set(
      [...html.matchAll(/<span class="product-label product-label--custom"[^>]*>([\s\S]*?)<\/span>/g)].map((m) =>
        htmlToText(m[1]),
      ),
    ),
  ].filter(Boolean);

  return {
    composition: field("구성"),
    age: field("연령"),
    extraInfo: infoText,
    publisherUrl: linkMatch ? decodeEntities(linkMatch[1]) : "",
    badges,
  };
}

function money(v: string | null | undefined) {
  return v ? Number(v) : null;
}

async function main() {
  console.log("1) 전집 상품 목록을 가져오는 중...");
  const products = await listCollection(COLLECTION);
  console.log(`   → ${products.length}개 상품`);

  console.log("2) 연령별 카테고리를 확인하는 중...");
  const ageMap = new Map<number, string[]>();
  for (const [handle, label] of Object.entries(AGE_COLLECTIONS)) {
    for (const p of await listCollection(handle)) {
      ageMap.set(p.id, [...(ageMap.get(p.id) ?? []), label]);
    }
  }

  console.log("3) 상세페이지를 하나씩 읽는 중...");
  const rows = [];
  for (const [i, p] of products.entries()) {
    const url = `${SITE}/products/${encodeURIComponent(p.handle)}`;
    let detail = { composition: "", age: "", extraInfo: "", publisherUrl: "", badges: [] as string[] };
    try {
      detail = parseDetailPage(await get(url));
    } catch (e) {
      console.warn(`   ! 상세페이지 실패: ${p.title} (${(e as Error).message})`);
    }
    const shipping = p.variants.find((v) => /ship/i.test(v.title)) ?? p.variants[0];
    const pickup = p.variants.find((v) => /pick/i.test(v.title));
    const bodyText = htmlToText(p.body_html ?? "");
    const detailImages = [...(p.body_html ?? "").matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);

    rows.push({
      no: i + 1,
      id: String(p.id),
      title: p.title,
      brand: p.vendor,
      categories: p.tags.filter((t) => SUB_CATEGORIES.includes(t)).join(", "),
      ageGroups: (ageMap.get(p.id) ?? []).join(", "),
      age: detail.age,
      composition: detail.composition,
      shippingPrice: money(shipping?.price),
      shippingListPrice: money(shipping?.compare_at_price),
      pickupPrice: money(pickup?.price),
      pickupListPrice: money(pickup?.compare_at_price),
      options: p.variants.map((v) => `${v.title}: $${v.price}${v.available ? "" : " (품절)"}`).join(" / "),
      available: p.variants.some((v) => v.available) ? "판매중" : "품절",
      badges: detail.badges.join(", "),
      tags: p.tags.join(", "),
      sku: shipping?.sku ?? "",
      weightKg: shipping?.grams ? Math.round(shipping.grams / 10) / 100 : null,
      description: bodyText,
      extraInfo: detail.extraInfo,
      detailImageCount: detailImages.length,
      url,
      publisherUrl: detail.publisherUrl,
      image: p.images[0]?.src ?? "",
      updatedAt: p.updated_at.slice(0, 10),
    });
    process.stdout.write(`\r   ${i + 1}/${products.length}`);
  }
  console.log("");

  console.log("4) 엑셀 파일을 만드는 중...");
  const wb = new ExcelJS.Workbook();
  wb.creator = "dchoi-chatbot";

  const ws = wb.addWorksheet("전집 상품", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "번호", key: "no", width: 6 },
    { header: "상품ID", key: "id", width: 16 },
    { header: "상품명", key: "title", width: 40 },
    { header: "브랜드", key: "brand", width: 14 },
    { header: "분류", key: "categories", width: 18 },
    { header: "연령 카테고리", key: "ageGroups", width: 14 },
    { header: "권장 연령", key: "age", width: 14 },
    { header: "구성", key: "composition", width: 40 },
    { header: "배송 가격($)", key: "shippingPrice", width: 12 },
    { header: "배송 정가($)", key: "shippingListPrice", width: 12 },
    { header: "픽업 가격($)", key: "pickupPrice", width: 12 },
    { header: "픽업 정가($)", key: "pickupListPrice", width: 12 },
    { header: "옵션별 가격", key: "options", width: 40 },
    { header: "판매상태", key: "available", width: 9 },
    { header: "할인/이벤트", key: "badges", width: 18 },
    { header: "태그", key: "tags", width: 30 },
    { header: "SKU", key: "sku", width: 22 },
    { header: "무게(kg)", key: "weightKg", width: 9 },
    { header: "상세 설명(텍스트)", key: "description", width: 60 },
    { header: "추가 정보", key: "extraInfo", width: 40 },
    { header: "상세 이미지 수", key: "detailImageCount", width: 10 },
    { header: "상품 URL", key: "url", width: 40 },
    { header: "출판사 상세 URL", key: "publisherUrl", width: 40 },
    { header: "대표 이미지", key: "image", width: 40 },
    { header: "업데이트", key: "updatedAt", width: 11 },
  ];
  ws.addRows(rows);
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF080808" } };
  ws.autoFilter = { from: "A1", to: "Y1" };

  // 챗봇이 기본으로 알고 있을 질의응답 목록 (운영자 페이지에서 수정 가능)
  const qa = wb.addWorksheet("질의응답", { views: [{ state: "frozen", ySplit: 1 }] });
  qa.columns = [
    { header: "번호", key: "no", width: 6 },
    { header: "분류", key: "category", width: 12 },
    { header: "질문", key: "question", width: 50 },
    { header: "답변", key: "answer", width: 80 },
    { header: "관련 상품", key: "product", width: 40 },
  ];
  const qaRows: { category: string; question: string; answer: string; product: string }[] = [
    {
      category: "공통",
      question: "배송과 픽업 중 어떤 걸 고를 수 있나요?",
      answer:
        "대부분의 전집은 'Shipping(배송)'과 'SoCal Pick-up(남가주 픽업)' 중에서 고를 수 있어요. 픽업이 배송보다 저렴하고, 픽업을 고르시면 주문 전에 지역별 재고 확인이 꼭 필요해요. 재고는 사이트의 '재고 조회 & 픽업 예약' 페이지나 카카오 채널로 확인하실 수 있어요.",
      product: "",
    },
    {
      category: "공통",
      question: "Zelle로 결제하면 할인이 있나요?",
      answer: "네, Zelle로 결제하시면 추가 3% 할인을 받으실 수 있어요.",
      product: "",
    },
    {
      category: "공통",
      question: "카드 결제 후 취소하면 수수료가 있나요?",
      answer: "카드 결제 후 결제를 취소하시면 3% 카드 수수료가 고객님 부담으로 발생해요.",
      product: "",
    },
    {
      category: "공통",
      question: "책이 빠져 있거나 파손되어 왔어요. 어떻게 하나요?",
      answer:
        "제품 누락이나 불량/파손은 제품을 받으신 날로부터 14일 이내에 A/S를 신청하셔야 처리가 가능해요. 채널톡 1:1 문의나 카카오 채널로 사진과 함께 알려주세요.",
      product: "",
    },
    {
      category: "공통",
      question: "프리오더 할인은 무엇인가요?",
      answer:
        "일부 전집에는 '프리오더 10% 할인' 같은 이벤트 배지가 붙어 있어요. 미리 주문(프리오더)하시면 정가보다 할인된 가격으로 구매하실 수 있어요. 상품마다 할인 여부가 다르니 상품 페이지를 확인해 주세요.",
      product: "",
    },
    {
      category: "공통",
      question: "사람 상담원과 이야기하고 싶어요.",
      answer: "사이트 하단의 '채널톡 1:1 문의' 또는 카카오 채널로 문의하시면 담당자가 직접 도와드려요.",
      product: "",
    },
  ];
  for (const r of rows) {
    const won = (n: number | null) => (n == null ? "" : `$${n.toFixed(2)}`);
    const priceLine =
      `배송 ${won(r.shippingPrice)}` +
      (r.shippingListPrice ? ` (정가 ${won(r.shippingListPrice)})` : "") +
      (r.pickupPrice ? `, 남가주 픽업 ${won(r.pickupPrice)}` : "");
    qaRows.push({ category: "가격", question: `${r.title} 가격이 얼마예요?`, answer: `${r.title}은(는) ${priceLine}이에요.${r.badges ? ` 현재 '${r.badges}' 적용 중이에요.` : ""}`, product: r.title });
    if (r.composition)
      qaRows.push({ category: "구성", question: `${r.title}은(는) 몇 권인가요? 구성이 어떻게 돼요?`, answer: `${r.title}의 구성은 ${r.composition}이에요.`, product: r.title });
    if (r.age || r.ageGroups)
      qaRows.push({ category: "연령", question: `${r.title}은(는) 몇 살 아이에게 맞나요?`, answer: `${r.title}은(는) ${r.age || r.ageGroups} 아이에게 추천드려요.`, product: r.title });
  }
  qa.addRows(qaRows.map((q, i) => ({ no: i + 1, ...q })));
  qa.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  qa.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF080808" } };
  for (const sheet of [ws, qa]) sheet.eachRow((row) => (row.alignment = { vertical: "top", wrapText: true }));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log(`완료! ${OUT}`);
  console.log(`   상품 ${rows.length}개, 질의응답 ${qaRows.length}개`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
