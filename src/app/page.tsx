"use client";

import { useEffect, useRef, useState } from "react";
import { Linkify } from "./Linkify";

type Msg = { role: "user" | "assistant"; content: string; ts: string; notice?: "warning" | "blocked" };
type Me = { name: string; email: string; status: string };

const EXAMPLES = [
  { color: "c-purple", tag: "연령 추천", q: "3살 아이에게 좋은 전집 추천해 주세요" },
  { color: "c-pink", tag: "구성", q: "그레이트북스 이야기 꽃할망은 몇 권이에요?" },
  { color: "c-blue", tag: "가격", q: "픽업하면 배송보다 얼마나 싸요?" },
  { color: "c-orange", tag: "할인", q: "지금 할인 중인 전집이 있나요?" },
  { color: "c-green", tag: "분야", q: "수학·과학 전집 뭐가 있어요?" },
];

export default function Home() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setMe(d.user))
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return null;
  return me ? <Chat me={me} onLogout={() => setMe(null)} /> : <Welcome onDone={setMe} />;
}

function Nav({ right }: { right?: React.ReactNode }) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="wordmark" href="/">
          dchoi09 <span>전집 상담</span>
        </a>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {right}
          <a className="nav-link" href="https://dchoi09.com/collections/series-books-all" target="_blank" rel="noreferrer">
            쇼핑몰 가기 →
          </a>
        </div>
      </div>
    </header>
  );
}

function Welcome({ onDone }: { onDone: (me: Me) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError(d.error ?? "잠시 후 다시 시도해 주세요.");
    onDone(d.user);
  }

  return (
    <>
      <Nav />
      <section className="hero">
        <div>
          <div className="eyebrow">dchoi09 · 전집 AI 상담</div>
          <h1 className="display" style={{ marginTop: 16 }}>
            우리 아이에게 맞는 전집, 물어보세요.
          </h1>
          <p className="lead">
            dchoi09.com의 전집 153종의 구성, 연령, 가격, 픽업 정보를 모두 알고 있는 상담 도우미가 바로 답해 드려요.
          </p>
        </div>
        <form className="card card-lift" onSubmit={submit}>
          <h2 className="display-sm">상담 시작하기</h2>
          <p className="small muted" style={{ marginTop: 4, marginBottom: 24 }}>
            이름과 이메일을 남겨 주시면 다음에 오셔도 대화를 이어갈 수 있어요.
          </p>
          <div className="field">
            <label className="label" htmlFor="name">이름</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" autoComplete="name" required />
          </div>
          <div className="field">
            <label className="label" htmlFor="email">이메일</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} disabled={busy}>
            {busy ? "잠시만요…" : "상담 시작"}
          </button>
          {error && <p className="error">{error}</p>}
          <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
            남겨주신 정보와 대화 내용은 상담 품질 향상을 위해 dchoi09 운영팀이 확인할 수 있어요.
          </p>
        </form>
      </section>
      <section className="cat-grid">
        {EXAMPLES.map((x) => (
          <div key={x.q} className={`cat-card ${x.color}`}>
            <div className="eyebrow-sm">{x.tag}</div>
            <p>“{x.q}”</p>
          </div>
        ))}
      </section>
    </>
  );
}

function Chat({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(me.status);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => {
        if (r.status === 401) onLogout();
        return r.json();
      })
      .then((d) => {
        if (d.messages) setMessages(d.messages);
        if (d.status) setStatus(d.status);
      });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError("");
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message, ts: new Date().toISOString() }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (res.status === 401) return onLogout(); // 로그인 정보가 사라졌으면 처음 화면으로
      const d = await res.json();
      if (d.messages) setMessages(d.messages);
      if (d.status) setStatus(d.status);
      if (d.blocked) setMessages((m) => [...m, { role: "assistant", content: d.reply, ts: new Date().toISOString(), notice: "blocked" }]);
      if (!res.ok) {
        setError(d.error ?? "문제가 생겼어요.");
        setMessages((m) => m.slice(0, -1));
        setInput(message);
      }
    } catch {
      setError("인터넷 연결을 확인해 주세요.");
      setMessages((m) => m.slice(0, -1));
      setInput(message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    onLogout();
  }

  const blocked = status === "blocked";

  return (
    <div className="chat-shell">
      <Nav
        right={
          <>
            <span className="small muted">{me.name}님</span>
            <button className="btn-text small" onClick={logout}>나가기</button>
          </>
        }
      />
      <div className="chat-scroll">
        <div className="chat-list">
          <div className="bubble bubble-bot">
            안녕하세요, {me.name}님! dchoi09 전집 상담 도우미예요. 아이 나이, 관심 분야, 궁금한 전집 이름을 말씀해 주시면 구성·가격·픽업 정보를 알려드릴게요.
          </div>
          {messages.length === 0 && (
            <div className="suggests">
              {EXAMPLES.map((x) => (
                <button key={x.q} className="chip" onClick={() => send(x.q)} disabled={busy || blocked}>
                  {x.q}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`bubble ${m.notice === "blocked" ? "bubble-blocked" : m.notice === "warning" ? "bubble-warning" : m.role === "user" ? "bubble-user" : "bubble-bot"}`}
            >
              {m.role === "assistant" ? <Linkify text={m.content} /> : m.content}
            </div>
          ))}
          {busy && (
            <div className="bubble bubble-bot">
              <span className="typing"><i /><i /><i /></span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="composer-inner">
          <textarea
            className="textarea"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={blocked ? "상담이 제한되었어요." : "궁금한 점을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"}
            disabled={blocked}
          />
          <button className="btn btn-primary" disabled={busy || blocked || !input.trim()}>
            보내기
          </button>
        </div>
        {error && <p className="error" style={{ textAlign: "center", margin: "0 0 12px" }}>{error}</p>}
      </form>
    </div>
  );
}
