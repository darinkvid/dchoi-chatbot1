export type UserStatus = "active" | "warned" | "blocked";

export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastSeenAt: string;
  status: UserStatus;
  warnings: number;
  lastMood: string;
  messageCount: number;
  lastMessage: string;
};

export type AbuseLevel = "none" | "suspicious" | "warn" | "block";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts: string;
  /** 사용자 메시지에만: 챗봇이 판단한 기분 */
  mood?: string;
  moodReason?: string;
  /** 사용자 메시지에만: 이상 사용자 판단 */
  abuse?: AbuseLevel;
  abuseReason?: string;
  /** 시스템이 붙인 경고/차단 안내 */
  notice?: "warning" | "blocked";
};

export type QAItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  product: string;
  updatedAt: string;
};

export type RuleSettings = {
  /** 경고가 이 횟수에 도달하면 자동 차단 */
  maxWarnings: number;
  /** 1분에 이 개수보다 많이 보내면 이상 사용자로 경고 */
  maxMessagesPerMinute: number;
  /** 한 번에 보낼 수 있는 글자 수 */
  maxMessageLength: number;
  warningMessage: string;
  blockedMessage: string;
};

export type Rules = {
  response: string;
  mood: string;
  abnormal: string;
  block: string;
  settings: RuleSettings;
  updatedAt: string;
};

export type Product = {
  id: string;
  title: string;
  brand: string;
  categories: string;
  ageGroups: string;
  age: string;
  composition: string;
  shippingPrice: number | null;
  shippingListPrice: number | null;
  pickupPrice: number | null;
  pickupListPrice: number | null;
  options: string;
  available: string;
  badges: string;
  tags: string;
  description: string;
  extraInfo: string;
  url: string;
  image: string;
};
