import ExcelJS from "exceljs";
import { listQA } from "@/lib/db";

/** 지금 챗봇이 쓰고 있는 질의응답 목록을 엑셀로 내려받기 */
export async function GET() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("질의응답");
  ws.columns = [
    { header: "번호", key: "no", width: 6 },
    { header: "분류", key: "category", width: 12 },
    { header: "질문", key: "question", width: 50 },
    { header: "답변", key: "answer", width: 80 },
    { header: "관련 상품", key: "product", width: 40 },
    { header: "수정일", key: "updatedAt", width: 22 },
  ];
  ws.addRows((await listQA()).map((q, i) => ({ no: i + 1, ...q })));
  ws.getRow(1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  const name = encodeURIComponent(`dchoi09_질의응답_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${name}`,
    },
  });
}
