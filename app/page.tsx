"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { VtuberEntry } from "@/lib/types";
import { subscribeVtubers } from "@/lib/vtubers-db";
import { subscribeFavorites } from "@/lib/favorites";
import VtuberCard from "@/components/VtuberCard";
import AuthButton from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const { user } = useAuth();
  const [vtubers, setVtubers] = useState<VtuberEntry[] | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  useEffect(() => {
    const unsub = subscribeVtubers(setVtubers);
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setFavorites(new Set());
      return;
    }
    const unsub = subscribeFavorites(user.uid, setFavorites);
    return unsub;
  }, [user]);

  const agencies = useMemo(() => {
    if (!vtubers) return [];
    return Array.from(
      new Set(vtubers.map((v) => v.agency).filter((a) => a && a.trim()))
    ).sort();
  }, [vtubers]);

  const filtered = useMemo(() => {
    if (!vtubers) return [];
    return vtubers.filter((v) => {
      if (onlyFavorites && !favorites.has(v.id)) return false;
      if (agencyFilter && v.agency !== agencyFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [v.name, v.nameEn ?? "", v.agency, ...v.tags]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [vtubers, search, agencyFilter, onlyFavorites, favorites]);

  const activeNames = (vtubers ?? [])
    .filter((v) => v.status === "active")
    .map((v) => v.name);
  const tickerItems = [...activeNames, ...activeNames];

  return (
    <>
      <div className="ticker">
        <div className="ticker-inner">
          {tickerItems.length === 0 ? (
            <span>등록된 버튜버가 없습니다</span>
          ) : (
            tickerItems.map((name, i) => (
              <span key={i}>
                <span className="live-dot" />
                {name}
              </span>
            ))
          )}
        </div>
      </div>

      <header className="site-header">
        <div>
          <div className="brand">
            버튜버 <span className="brand-mark">편성표</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/request/" className="filter-chip">
            + 버튜버 추가 요청
          </Link>
          <AuthButton />
        </div>
      </header>

      <main className="container">
        <div className="toolbar">
          <input
            className="filter-chip"
            style={{ cursor: "text", minWidth: 180 }}
            placeholder="이름, 소속, 태그 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="filter-chip"
            data-active={agencyFilter === null}
            onClick={() => setAgencyFilter(null)}
          >
            전체 소속
          </button>
          {agencies.map((a) => (
            <button
              key={a}
              className="filter-chip"
              data-active={agencyFilter === a}
              onClick={() => setAgencyFilter(agencyFilter === a ? null : a)}
            >
              {a}
            </button>
          ))}
          {user && (
            <button
              className="filter-chip"
              data-active={onlyFavorites}
              onClick={() => setOnlyFavorites((v) => !v)}
            >
              ★ 즐겨찾기만
            </button>
          )}
        </div>

        {vtubers === null ? (
          <div className="empty-state">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">조건에 맞는 버튜버가 없습니다.</div>
        ) : (
          <div className="grid">
            {filtered.map((v) => (
              <VtuberCard key={v.id} vtuber={v} favorited={favorites.has(v.id)} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
