import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 엑셀 파일을 서버(Vercel)에 함께 올려서 챗봇이 읽을 수 있게 합니다.
  outputFileTracingIncludes: {
    "/api/**": ["./data/**"],
    "/admin/**": ["./data/**"],
  },
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
