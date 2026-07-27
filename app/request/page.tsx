"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { addRequest } from "@/lib/requests";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import AuthButton from "@/components/AuthButton";

const EMPTY_FORM = {
  name: "",
  namuUrl: "",
  youtube: "",
};

export default function RequestPage() {
  const { user, loading } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const update = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      alert("버튜버 이름은 필수입니다.");
      return;
    }
    setSubmitting(true);
    try {
      await addRequest({
        uid: user.uid,
        displayName: user.displayName ?? "익명",
        name: form.name.trim(),
        namuUrl: form.namuUrl.trim() || undefined,
        youtube: form.youtube.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container">
      <header className="site-header" style={{ padding: "24px 0" }}>
        <div className="brand">
          버튜버 <span className="brand-mark">추가 요청</span>
        </div>
        <AuthButton />
      </header>

      <Link href="/" className="back-link">
        ← 전체 목록
      </Link>

      {loading ? (
        <div className="empty-state">확인 중...</div>
      ) : !user ? (
        <div className="empty-state">
          요청을 남기려면 로그인이 필요합니다.
          <br />
          <br />
          <button
            className="filter-chip"
            data-active="true"
            onClick={() => signInWithPopup(auth, googleProvider)}
          >
            Google로 로그인
          </button>
        </div>
      ) : done ? (
        <div className="empty-state">
          ✓ 요청이 접수되었습니다. 검토 후 반영될 예정이에요.
          <br />
          <br />
          <button className="filter-chip" onClick={() => setDone(false)}>
            추가 요청 하나 더 하기
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="detail-hero" style={{ maxWidth: 480 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            어떤 버튜버를 추가할까요?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label>
              <div className="brand-sub">이름 *</div>
              <input
                className="filter-chip"
                style={{ width: "100%", cursor: "text" }}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="버튜버 이름"
              />
            </label>
            <label>
              <div className="brand-sub">나무위키 링크</div>
              <input
                className="filter-chip"
                style={{ width: "100%", cursor: "text" }}
                value={form.namuUrl}
                onChange={(e) => update("namuUrl", e.target.value)}
                placeholder="https://namu.wiki/w/..."
              />
            </label>
            <label>
              <div className="brand-sub">유튜브 링크</div>
              <input
                className="filter-chip"
                style={{ width: "100%", cursor: "text" }}
                value={form.youtube}
                onChange={(e) => update("youtube", e.target.value)}
                placeholder="https://youtube.com/@..."
              />
            </label>
          </div>
          <button
            type="submit"
            className="filter-chip"
            data-active="true"
            disabled={submitting}
            style={{ marginTop: 18 }}
          >
            {submitting ? "제출 중..." : "요청 보내기"}
          </button>
        </form>
      )}
    </main>
  );
}
