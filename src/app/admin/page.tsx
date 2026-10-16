"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Linkify } from "../Linkify";
import type { ChatMessage, Product, QAItem, Rules, User } from "@/lib/types";

type Tab = "conv" | "qa" | "rules" | "products";

const TABS: { id: Tab; label: string; color: string }[] = [
  { id: "conv", label: "대화 기록", color: "var(--purple)" },
  { id: "qa", label: "질의응답", color: "var(--blue)" },
  { id: "rules", label: "챗봇 규칙", color: "var(--orange)" },
  { id: "products", label: "전집 상품", color: "var(--green)" },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (res.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("로그인이 필요해요.");
  }
  const d = await res.json();
  if (!res.ok) throw new Error(d.error ?? "요청 실패");
  return d as T;
}

const fmt = (iso: string) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

export default function Admin() {
  const [tab, setTab] = useState<Tab>("conv");
  const [toast, setToast] = useState("");
  const notify = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="admin-shell">
      <nav className="sidebar">
        <div className="wordmark-wrap" style={{ padding: "0 16px 24px" }}>
          <div className="wordmark">dchoi09 <span>운영자</span></div>
        </div>
        {TABS.map((t) => (
          <button key={t.id} className={`side-row ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            <span className="side-dot" style={{ background: t.color }} />
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <a className="side-row" href="/" target="_blank">고객 화면 열기 ↗</a>
        <button className="side-row" onClick={logout}>로그아웃</button>
      </nav>
      <main className="admin-main">
        {tab === "conv" && <Conversations notify={notify} />}
        {tab === "qa" && <QAManager notify={notify} />}
        {tab === "rules" && <RulesEditor notify={notify} />}
        {tab === "products" && <Products />}
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ────────────────────────────── 대화 기록 ──────────────────────────────

const STATUS_BADGE: Record<string, [string, string]> = {
  active: ["badge-ok", "정상"],
  warned: ["badge-warn", "경고"],
  blocked: ["badge-bad", "차단"],
};
const MOOD_BADGE = (m: string) =>
  /화남|불만/.test(m) ? "badge-bad" : /급함/.test(m) ? "badge-warn" : /긍정/.test(m) ? "badge-ok" : m ? "badge-soft" : "badge-gray";
const ABUSE_LABEL: Record<string, string> = { suspicious: "주의", warn: "경고", block: "차단" };

function Conversations({ notify }: { notify: (m: string) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [storageMode, setStorageMode] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ user: User; messages: ChatMessage[] } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const loadUsers = useCallback(async () => {
    const d = await api<{ users: User[]; storageMode: string }>("/api/admin/users");
    setUsers(d.users);
    setStorageMode(d.storageMode);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetail(await api(`/api/admin/users/${id}`));
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);
  useEffect(() => {
    if (selected) loadDetail(selected);
  }, [selected, loadDetail]);

  async function update(body: object, msg: string) {
    if (!selected) return;
    await api(`/api/admin/users/${selected}`, { method: "PATCH", body: JSON.stringify(body) });
    notify(msg);
    await Promise.all([loadUsers(), loadDetail(selected)]);
  }

  async function remove() {
    if (!selected || !confirm("이 사용자와 대화 기록을 모두 삭제할까요? 되돌릴 수 없어요.")) return;
    await api(`/api/admin/users/${selected}`, { method: "DELETE" });
    notify("삭제했어요.");
    setSelected(null);
    setDetail(null);
    loadUsers();
  }

  const shown = users.filter(
    (u) =>
      (filter === "all" || u.status === filter) &&
      (!search || `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())),
  );
  const count = (s: string) => users.filter((u) => u.status === s).length;

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Conversations</div>
          <h1 className="display-md">대화 기록</h1>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => { loadUsers(); if (selected) loadDetail(selected); }}>
          새로고침
        </button>
      </div>
      {storageMode === "file" && (
        <div className="warn-banner">
          지금은 임시 저장소(파일)를 쓰고 있어요. Vercel에 올린 뒤에는 안내서 7단계대로 Upstash Redis를 꼭 연결해야 대화 기록이 사라지지 않아요.
        </div>
      )}
      <div className="stats">
        <div className="stat c-purple"><b>{users.length}</b><span>전체 사용자</span></div>
        <div className="stat c-blue"><b>{users.reduce((a, u) => a + u.messageCount, 0)}</b><span>받은 질문</span></div>
        <div className="stat c-orange"><b>{count("warned")}</b><span>경고 중</span></div>
        <div className="stat c-pink"><b>{count("blocked")}</b><span>차단됨</span></div>
      </div>
      <div className="split">
        <div>
          <div className="toolbar">
            <input className="input" placeholder="이름·이메일 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">전체</option>
              <option value="active">정상</option>
              <option value="warned">경고</option>
              <option value="blocked">차단</option>
            </select>
          </div>
          <div className="list">
            {shown.length === 0 && <p className="small muted" style={{ padding: 16, margin: 0 }}>아직 대화한 사용자가 없어요.</p>}
            {shown.map((u) => (
              <button key={u.id} className={`list-item ${selected === u.id ? "active" : ""}`} onClick={() => setSelected(u.id)}>
                <div className="top">
                  <strong className="ellipsis">{u.name}</strong>
                  <span className={`badge ${STATUS_BADGE[u.status][0]}`}>{STATUS_BADGE[u.status][1]}</span>
                </div>
                <div className="small muted ellipsis">{u.email}</div>
                <div className="small ellipsis" style={{ marginTop: 4 }}>{u.lastMessage || "—"}</div>
                <div className="meta">
                  {fmt(u.lastSeenAt)} · 질문 {u.messageCount}개{u.lastMood && ` · 기분: ${u.lastMood}`}
                  {u.warnings > 0 && ` · 경고 ${u.warnings}`}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="conv">
          {!detail ? (
            <p className="muted" style={{ padding: 24, margin: 0 }}>왼쪽에서 사용자를 고르면 대화 내용이 보여요.</p>
          ) : (
            <>
              <div className="conv-head">
                <div>
                  <h2 className="display-sm" style={{ fontSize: 20 }}>{detail.user.name}</h2>
                  <div className="small muted">
                    {detail.user.email} · 가입 {fmt(detail.user.createdAt)} · 경고 {detail.user.warnings}회 ·{" "}
                    <span className={`badge ${STATUS_BADGE[detail.user.status][0]}`}>{STATUS_BADGE[detail.user.status][1]}</span>
                  </div>
                </div>
                <div className="toolbar" style={{ margin: 0 }}>
                  {detail.user.status === "blocked" ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => update({ status: "active", resetWarnings: true }, "차단을 풀었어요.")}>차단 해제</button>
                  ) : (
                    <button className="btn btn-danger btn-sm" onClick={() => update({ status: "blocked" }, "차단했어요.")}>차단하기</button>
                  )}
                  {detail.user.warnings > 0 && detail.user.status !== "blocked" && (
                    <button className="btn btn-secondary btn-sm" onClick={() => update({ status: "active", resetWarnings: true }, "경고를 초기화했어요.")}>경고 초기화</button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={remove}>삭제</button>
                </div>
              </div>
              <div className="conv-body">
                {detail.messages.length === 0 && <p className="muted small">대화가 없어요.</p>}
                {detail.messages.map((m, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                    <div
                      className={`bubble ${m.notice === "blocked" ? "bubble-blocked" : m.notice === "warning" ? "bubble-warning" : m.role === "user" ? "bubble-user" : "bubble-bot"}`}
                    >
                      {m.role === "assistant" ? <Linkify text={m.content} /> : m.content}
                    </div>
                    <div className={`meta ${m.role === "user" ? "meta-user" : ""}`}>
                      {fmt(m.ts)}
                      {m.role === "user" && m.mood && (
                        <>
                          {" · "}
                          <span className={`badge ${MOOD_BADGE(m.mood)}`} title={m.moodReason}>{m.mood}</span>
                          {m.moodReason && <span> {m.moodReason}</span>}
                        </>
                      )}
                      {m.abuse && m.abuse !== "none" && (
                        <>
                          {" · "}
                          <span className={`badge ${m.abuse === "suspicious" ? "badge-warn" : "badge-bad"}`}>이상: {ABUSE_LABEL[m.abuse]}</span>
                          <span> {m.abuseReason}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ────────────────────────────── 질의응답 ──────────────────────────────

type Draft = Partial<QAItem>;

function QAManager({ notify }: { notify: (m: string) => void }) {
  const [qa, setQA] = useState<QAItem[]>([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [limit, setLimit] = useState(100);
  const [error, setError] = useState("");

  const load = useCallback(async () => setQA((await api<{ qa: QAItem[] }>("/api/admin/qa")).qa), []);
  useEffect(() => {
    load();
  }, [load]);

  const cats = useMemo(() => [...new Set(qa.map((q) => q.category))], [qa]);
  const shown = qa.filter(
    (q) =>
      (cat === "all" || q.category === cat) &&
      (!search || `${q.question} ${q.answer} ${q.product}`.toLowerCase().includes(search.toLowerCase())),
  );

  async function save() {
    if (!editing) return;
    setError("");
    try {
      if (editing.id) await api(`/api/admin/qa/${editing.id}`, { method: "PATCH", body: JSON.stringify(editing) });
      else await api("/api/admin/qa", { method: "POST", body: JSON.stringify(editing) });
      setEditing(null);
      notify("저장했어요. 다음 질문부터 챗봇이 바로 사용해요.");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(q: QAItem) {
    if (!confirm(`이 질의응답을 삭제할까요?\n\n${q.question}`)) return;
    await api(`/api/admin/qa/${q.id}`, { method: "DELETE" });
    notify("삭제했어요.");
    load();
  }

  async function reset() {
    if (!confirm("엑셀 원본 상태로 되돌릴까요? 운영자가 추가·수정한 내용은 모두 사라져요.")) return;
    setQA((await api<{ qa: QAItem[] }>("/api/admin/qa/reset", { method: "POST" })).qa);
    notify("엑셀 원본으로 되돌렸어요.");
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Knowledge</div>
          <h1 className="display-md">질의응답 목록</h1>
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            엑셀(data/dchoi09_전집.xlsx)에서 만든 기본 답변이에요. 여기서 고치면 챗봇이 바로 그 답을 우선해서 사용해요.
          </p>
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({ category: "공통", question: "", answer: "", product: "" })}>+ 새 질의응답</button>
          <a className="btn btn-secondary btn-sm" href="/api/admin/qa/export">엑셀로 내려받기</a>
          <button className="btn btn-danger btn-sm" onClick={reset}>엑셀 원본으로 초기화</button>
        </div>
      </div>
      <div className="toolbar">
        <input className="input" placeholder="질문·답변·상품 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">모든 분류</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="small muted">{shown.length}개</span>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>분류</th><th>질문</th><th>답변</th><th>관련 상품</th><th></th></tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((q) => (
              <tr key={q.id}>
                <td><span className="badge badge-soft">{q.category}</span></td>
                <td className="q">{q.question}</td>
                <td className="a">{q.answer}</td>
                <td className="small muted">{q.product}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(q)}>수정</button>{" "}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(q)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length > limit && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setLimit((l) => l + 100)}>더 보기 ({shown.length - limit}개 남음)</button>
        </div>
      )}
      {editing && (
        <div className="modal-bg" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="display-sm" style={{ marginBottom: 24 }}>{editing.id ? "질의응답 수정" : "새 질의응답"}</h2>
            <div className="field">
              <label className="label">분류</label>
              <input className="input" list="qa-cats" value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
              <datalist id="qa-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="field">
              <label className="label">질문</label>
              <input className="input" value={editing.question ?? ""} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">답변</label>
              <textarea className="textarea" value={editing.answer ?? ""} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">관련 상품 (선택)</label>
              <input className="input" value={editing.product ?? ""} onChange={(e) => setEditing({ ...editing, product: e.target.value })} />
            </div>
            {error && <p className="error">{error}</p>}
            <div className="toolbar" style={{ justifyContent: "flex-end", margin: "24px 0 0" }}>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>취소</button>
              <button className="btn btn-primary" onClick={save}>저장</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ────────────────────────────── 규칙 ──────────────────────────────

const RULE_FIELDS: { key: "response" | "mood" | "abnormal" | "block"; title: string; help: string; color: string }[] = [
  { key: "response", title: "응대 규칙", help: "챗봇의 말투, 답변 길이, 해도 되는 말과 안 되는 말", color: "var(--purple)" },
  { key: "mood", title: "사용자 기분 파악 규칙", help: "기분을 어떤 이름으로 나누고, 기분별로 어떻게 대응할지", color: "var(--pink)" },
  { key: "abnormal", title: "이상 사용자 판별 및 경고 규칙", help: "어떤 메시지를 '주의(suspicious)' 또는 '경고(warn)'로 볼지", color: "var(--orange)" },
  { key: "block", title: "차단 규칙", help: "어떤 메시지면 바로 차단(block)할지", color: "var(--red)" },
];

function RulesEditor({ notify }: { notify: (m: string) => void }) {
  const [rules, setRules] = useState<Rules | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setRules((await api<{ rules: Rules }>("/api/admin/rules")).rules);
    setDirty(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (!rules) return null;
  const set = (patch: Partial<Rules>) => {
    setRules({ ...rules, ...patch });
    setDirty(true);
  };
  const setS = (patch: Partial<Rules["settings"]>) => set({ settings: { ...rules.settings, ...patch } });

  async function save() {
    setError("");
    try {
      setRules((await api<{ rules: Rules }>("/api/admin/rules", { method: "PUT", body: JSON.stringify(rules) })).rules);
      setDirty(false);
      notify("규칙을 저장했어요. 다음 질문부터 적용돼요.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function reset() {
    if (!confirm("처음 기본 규칙으로 되돌릴까요?")) return;
    setRules((await api<{ rules: Rules }>("/api/admin/rules", { method: "DELETE" })).rules);
    setDirty(false);
    notify("기본 규칙으로 되돌렸어요.");
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Rules</div>
          <h1 className="display-md">챗봇 규칙</h1>
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            {rules.updatedAt ? `마지막 저장: ${fmt(rules.updatedAt)}` : "기본 규칙을 사용 중이에요."} 쉬운 한국어 문장으로 적으면 챗봇이 그대로 따라요.
          </p>
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          <button className="btn btn-danger btn-sm" onClick={reset}>기본값으로</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={!dirty}>{dirty ? "저장하기" : "저장됨"}</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="rules-grid">
        {RULE_FIELDS.map((f) => (
          <div key={f.key} className="rule-card">
            <div className="rule-title">
              <span className="side-dot" style={{ background: f.color }} />
              <h3 style={{ fontSize: 18, fontWeight: 500 }}>{f.title}</h3>
            </div>
            <p className="small muted" style={{ margin: 0 }}>{f.help}</p>
            <textarea className="textarea" value={rules[f.key]} onChange={(e) => set({ [f.key]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="rule-card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 500 }}>숫자 설정 · 안내 문구</h3>
        <div className="settings-grid">
          <div>
            <label className="label">자동 차단까지 경고 횟수</label>
            <input className="input" type="number" min={1} value={rules.settings.maxWarnings} onChange={(e) => setS({ maxWarnings: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">1분당 최대 메시지 수</label>
            <input className="input" type="number" min={1} value={rules.settings.maxMessagesPerMinute} onChange={(e) => setS({ maxMessagesPerMinute: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">메시지 최대 글자 수</label>
            <input className="input" type="number" min={50} value={rules.settings.maxMessageLength} onChange={(e) => setS({ maxMessageLength: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="label">경고할 때 보여줄 문구</label>
          <input className="input" value={rules.settings.warningMessage} onChange={(e) => setS({ warningMessage: e.target.value })} />
        </div>
        <div>
          <label className="label">차단할 때 보여줄 문구</label>
          <input className="input" value={rules.settings.blockedMessage} onChange={(e) => setS({ blockedMessage: e.target.value })} />
        </div>
      </div>
    </>
  );
}

// ────────────────────────────── 상품 ──────────────────────────────

function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    api<{ products: Product[] }>("/api/admin/products").then((d) => setProducts(d.products));
  }, []);
  const money = (n: number | null) => (n == null ? "-" : `$${n.toFixed(2)}`);
  const shown = products.filter((p) => !search || `${p.title} ${p.brand} ${p.categories} ${p.tags}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Catalog</div>
          <h1 className="display-md">전집 상품 ({products.length})</h1>
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            엑셀 파일 data/dchoi09_전집.xlsx의 내용이에요. 상품을 새로 가져오려면 안내서의 &quot;상품 다시 수집하기&quot;를 보세요.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <input className="input" placeholder="상품명·브랜드·분류 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="small muted">{shown.length}개</span>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>상품명</th><th>브랜드</th><th>연령</th><th>구성</th><th>배송</th><th>픽업</th><th>상태</th></tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td className="q"><a href={p.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{p.title}</a>{p.badges && <> <span className="badge badge-info">{p.badges}</span></>}</td>
                <td>{p.brand}</td>
                <td>{p.age || p.ageGroups || "-"}</td>
                <td style={{ minWidth: 240 }}>{p.composition || "-"}</td>
                <td>{money(p.shippingPrice)}</td>
                <td>{money(p.pickupPrice)}</td>
                <td><span className={`badge ${p.available === "판매중" ? "badge-ok" : "badge-gray"}`}>{p.available}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
