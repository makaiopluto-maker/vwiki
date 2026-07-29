"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { VtuberEntry } from "@/lib/types";
import { deleteVtuber, getVtuberById, incrementView } from "@/lib/vtubers-db";
import PlatformLinks from "@/components/PlatformLinks";
import NamuExcerpt from "@/components/NamuExcerpt";
import ProfileTable from "@/components/ProfileTable";
import Comments from "@/components/Comments";
import AuthButton from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/admin";

function VtuberDetailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = searchParams.get("id");
  const [vtuber, setVtuber] = useState<VtuberEntry | null | undefined>(
    undefined
  );
  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) {
      setVtuber(null);
      return;
    }
    getVtuberById(id).then(setVtuber);
    if (viewedRef.current !== id) {
      viewedRef.current = id;
      incrementView(id);
    }
  }, [id]);

  const handleDelete = async () => {
    if (!vtuber) return;
    if (!confirm(`"${vtuber.name}"을(를) 정말 삭제할까요? 되돌릴 수 없어요.`)) return;
    try {
      await deleteVtuber(vtuber.id);
      router.push("/");
    } catch (err: any) {
      alert(`삭제 실패: ${err?.message ?? err}`);
    }
  };

  return (
    <main className="container">
      <header className="site-header" style={{ padding: "24px 0" }}>
        <div />
        <AuthButton />
      </header>

      <Link href="/" className="back-link">
        ← 전체 목록
      </Link>

      {vtuber === undefined ? (
        <div className="empty-state">불러오는 중...</div>
      ) : vtuber === null ? (
        <div className="empty-state">해당 버튜버를 찾을 수 없습니다.</div>
      ) : (
        <>
          <div
            className="detail-hero"
            style={{ ["--hero-accent" as any]: vtuber.color }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h1 className="detail-name">{vtuber.name}</h1>
                <div className="detail-meta">
                  {vtuber.agency}
                  {vtuber.debutDate ? ` · 데뷔 ${vtuber.debutDate}` : ""}
                  {" · "}
                  {vtuber.status === "active"
                    ? "활동 중"
                    : vtuber.status === "hiatus"
                    ? "휴방 중"
                    : "졸업"}
                  {" · 조회 "}
                  {(vtuber.views ?? 0) + 1}
                </div>
              </div>
              {isAdmin(user?.email) && (
                <button className="filter-chip" onClick={handleDelete}>
                  이 버튜버 삭제
                </button>
              )}
            </div>
          </div>

          <div className="section-title">방송 플랫폼</div>
          <PlatformLinks platforms={vtuber.platforms} />

          {vtuber.namu.profile && (
            <>
              <div className="section-title">프로필</div>
              <ProfileTable profile={vtuber.namu.profile} />
            </>
          )}

          <div className="section-title">나무위키 개요</div>
          <NamuExcerpt namu={vtuber.namu} />

          <div className="section-title">댓글</div>
          <Comments vtuberId={vtuber.id} />
        </>
      )}
    </main>
  );
}

export default function VtuberDetailPage() {
  return (
    <Suspense fallback={<main className="container empty-state">불러오는 중...</main>}>
      <VtuberDetailInner />
    </Suspense>
  );
}