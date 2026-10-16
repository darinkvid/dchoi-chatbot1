"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) window.location.href = "/admin";
    else setError((await res.json()).error ?? "로그인 실패");
  }

  return (
    <main className="center-page">
      <form className="card card-lift" style={{ width: "100%", maxWidth: 420 }} onSubmit={submit}>
        <div className="eyebrow">dchoi09 · 운영자</div>
        <h1 className="display-sm" style={{ margin: "8px 0 24px" }}>운영자 로그인</h1>
        <div className="field">
          <label className="label" htmlFor="pw">비밀번호</label>
          <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        </div>
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? "확인 중…" : "로그인"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
