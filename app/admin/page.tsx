"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/admin";
import { RequestEntry, VtuberEntry } from "@/lib/types";
import { deleteVtuber, subscribeVtubers, upsertVtuber } from "@/lib/vtubers-db";
import { deleteRequest, subscribeRequests } from "@/lib/requests";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import Link from "next/link";

const EMPTY: VtuberEntry = {
  id: "",
  name: "",
  nameEn: "",
  agency: "",
  debutDate: "",
  status: "active",
  tags: [],
  color: "#7C5CFF",
  platforms: {},
  namu: { url: "", excerpt: "", fetchedAt: null },
};

const COLOR_PALETTE = ["#d9603b", "#5c7a5e", "#c99a3d", "#7c5cff", "#3d84c9"];

function makeId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "");
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [vtubers, setVtubers] = useState<VtuberEntry[]>([]);
  const [requests, setRequests] = useState<RequestEntry[]>([]);
  const [form, setForm] = useState<VtuberEntry>(EMPTY);
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  const [quickName, setQuickName] = useState("");
  const [quickNamu, setQuickNamu] = useState("");
  const [quickYoutube, setQuickYoutube] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickDone, setQuickDone] = useState(false);

  useEffect(() => {
    const unsub = subscribeVtubers(setVtubers);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeRequests(setRequests);
    return unsub;
  }, []);

  if (loading) {
    return <main className="container empty-state">확인 중...</main>;
  }

  if (!user) {
    return (
      <main className="container">
        <div className="empty-state">
          관리자 페이지는 로그인이 필요합니다.
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
      </main>
    );
  }

  if (!isAdmin(user.email)) {
    return (
      <main className="container">
        <div className="empty-state">
          이 계정({user.email})은 관리자 권한이 없습니다.
        </div>
      </main>
    );
  }

  const startEdit = (v: VtuberEntry) => {
    setForm(v);
    setTagsInput(v.tags.join(", "));
  };

  const resetForm = () => {
    setForm(EMPTY);
    setTagsInput("");
  };

  const importFromRequest = (r: RequestEntry) => {
    setForm({
      ...EMPTY,
      id: "",
      name: r.name,
      agency: r.agency ?? "",
      platforms: {
        youtube: r.youtube || undefined,
        chzzk: r.chzzk || undefined,
        twitch: r.twitch || undefined,
        twitter: r.twitter || undefined,
      },
      namu: { url: r.namuUrl ?? "", excerpt: "", fetchedAt: null },
    });
    setTagsInput("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!form.id || !form.name) {
      alert("id와 이름은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      await upsertVtuber({
        ...form,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      resetForm();
      alert("저장됐어요.");
    } catch (err: any) {
      console.error(err);
      alert(`저장 실패: ${err?.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAdd = async () => {
    if (!quickName.trim()) {
      alert("이름은 필수입니다.");
      return;
    }
    setQuickSaving(true);
    try {
      const id = makeId(quickName);
      await upsertVtuber({
        ...EMPTY,
        id,
        name: quickName.trim(),
        color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
        platforms: { youtube: quickYoutube.trim() || undefined },
        namu: { url: quickNamu.trim(), excerpt: "", fetchedAt: null },
      });
      setQuickName("");
      setQuickNamu("");
      setQuickYoutube("");
      setQuickDone(true);
      setTimeout(() => setQuickDone(false), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`저장 실패: ${err?.message ?? err}`);
    } finally {
      setQuickSaving(false);
    }
  };

  const setPlatform = (key: string, value: string) => {
    setForm((f) => ({
      ...f,
      platforms: { ...f.platforms, [key]: value || undefined },
    }));
  };

  return (
    <main className="container">
      <header className="site-header" style={{ padding: "24px 0" }}>
        <div className="brand">
          관리자 <span className="brand-mark">패널</span>
        </div>
        <Link href="/" className="back-link">
          ← 사이트로
        </Link>
      </header>

      <div className="detail-hero" style={{ ["--hero-accent" as any]: "var(--accent)" }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          빠른 추가 (이름 + 링크만)
        </div>
        <div className="brand-sub" style={{ marginBottom: 14 }}>
          소속·태그·색상 같은 세부 정보는 자동으로 기본값이 들어가고, 아래 목록에서
          나중에 "수정"으로 채워 넣을 수 있어요.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="filter-chip"
            style={{ flex: "1 1 160px", cursor: "text" }}
            placeholder="이름 *"
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
          />
          <input
            className="filter-chip"
            style={{ flex: "2 1 220px", cursor: "text" }}
            placeholder="나무위키 링크 (https://namu.wiki/w/...)"
            value={quickNamu}
            onChange={(e) => setQuickNamu(e.target.value)}
          />
          <input
            className="filter-chip"
            style={{ flex: "2 1 220px", cursor: "text" }}
            placeholder="유튜브 링크 (선택)"
            value={quickYoutube}
            onChange={(e) => setQuickYoutube(e.target.value)}
          />
          <button
            className="filter-chip"
            data-active="true"
            onClick={handleQuickAdd}
            disabled={quickSaving}
          >
            {quickSaving ? "추가 중..." : "추가"}
          </button>
        </div>
        {quickDone && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              background: "var(--sage)",
              color: "#fff",
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            ✓ 추가됐어요! 나무위키 개요를 채우려면 아래 "나무위키 개요 지금 갱신하기"를
            눌러주세요 (1분 정도 걸려요).
          </div>
        )}
      </div>

      <div className="detail-hero">
        <div className="section-title" style={{ marginTop: 0 }}>
          {form.id ? `세부 수정: ${form.id}` : "세부 정보 직접 입력 (선택)"}
        </div>
        <a
          href="https://github.com/makaiopluto-maker/vwiki/actions/workflows/update-namu-excerpts.yml"
          target="_blank"
          rel="noopener noreferrer"
          className="filter-chip"
          style={{ display: "inline-block", marginBottom: 16 }}
        >
          나무위키 개요 지금 갱신하기 (GitHub Actions) →
        </a>
        <div className="brand-sub" style={{ marginBottom: 16 }}>
          클릭 후 GitHub 화면에서 우측의 "Run workflow" 버튼을 눌러주세요. 1분 정도 걸려요.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div className="brand-sub">ID (영문 슬러그, 고유값)</div>
            <input
              className="filter-chip"
              style={{ width: "100%", cursor: "text" }}
              value={form.id}
              disabled={!!vtubers.find((v) => v.id === form.id) && form.id !== ""}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              placeholder="example-member-01"
            />
          </label>
          <label>
            <div className="brand-sub">이름</div>
            <input
              className="filter-chip"
              style={{ width: "100%", cursor: "text" }}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            <div className="brand-sub">소속</div>
            <input
              className="filter-chip"
              style={{ width: "100%", cursor: "text" }}
              value={form.agency}
              onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))}
            />
          </label>
          <label>
            <div className="brand-sub">데뷔일 (YYYY-MM-DD)</div>
            <input
              className="filter-chip"
              style={{ width: "100%", cursor: "text" }}
              value={form.debutDate}
              onChange={(e) => setForm((f) => ({ ...f, debutDate: e.target.value }))}
            />
          </label>
          <label>
            <div className="brand-sub">상태</div>
            <select
              className="filter-chip"
              style={{ width: "100%" }}
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as VtuberEntry["status"] }))
              }
            >
              <option value="active">활동 중</option>
              <option value="hiatus">휴방 중</option>
              <option value="graduated">졸업</option>
            </select>
          </label>
          <label>
            <div className="brand-sub">테마 컬러 (hex)</div>
            <input
              className="filter-chip"
              style={{ width: "100%", cursor: "text" }}
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            <div className="brand-sub">태그 (쉼표로 구분)</div>
            <input
              className="filter-chip"
              style={{ width: "100%", cursor: "text" }}
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="게임, 노래, 잡담"
            />
          </label>

          {(["youtube", "chzzk", "twitch", "twitter"] as const).map((p) => (
            <label key={p}>
              <div className="brand-sub">{p}</div>
              <input
                className="filter-chip"
                style={{ width: "100%", cursor: "text" }}
                value={form.platforms[p] ?? ""}
                onChange={(e) => setPlatform(p, e.target.value)}
              />
            </label>
          ))}

          <label style={{ gridColumn: "1 / -1" }}>
            <div className="brand-sub">나무위키 URL</div>
            <input
              className="filter-chip"
              style={{ width: "100%", cursor: "text" }}
              value={form.namu.url}
              onChange={(e) =>
                setForm((f) => ({ ...f, namu: { ...f.namu, url: e.target.value } }))
              }
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            className="filter-chip"
            data-active="true"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "저장 중..." : form.id ? "저장" : "추가"}
          </button>
          <button className="filter-chip" onClick={resetForm}>
            취소 / 새로 만들기
          </button>
        </div>
      </div>

      <div className="section-title">대기 중인 추가 요청 ({requests.length})</div>
      {requests.length === 0 ? (
        <div className="empty-state" style={{ padding: "20px 0" }}>
          대기 중인 요청이 없습니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          {requests.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "10px 16px",
                background: "var(--card)",
              }}
            >
              <div>
                <strong>{r.name}</strong>{" "}
                <span className="brand-sub">
                  {r.agency ?? "소속 미기재"} · {r.displayName}
                </span>
                {r.note && (
                  <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
                    “{r.note}”
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="filter-chip" onClick={() => importFromRequest(r)}>
                  가져오기
                </button>
                <button className="filter-chip" onClick={() => deleteRequest(r.id)}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">등록된 버튜버 ({vtubers.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {vtubers.map((v) => (
          <div
            key={v.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "10px 16px",
              background: "var(--card)",
            }}
          >
            <div>
              <strong>{v.name}</strong>{" "}
              <span className="brand-sub">
                {v.id} · {v.agency}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="filter-chip" onClick={() => startEdit(v)}>
                수정
              </button>
              <button
                className="filter-chip"
                onClick={() => {
                  if (confirm(`${v.name}을(를) 삭제할까요?`)) deleteVtuber(v.id);
                }}
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
