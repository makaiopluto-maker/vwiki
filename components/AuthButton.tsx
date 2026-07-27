"use client";

import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/admin";
import Link from "next/link";

export default function AuthButton() {
  const { user, loading } = useAuth();

  if (loading) {
    return <span className="brand-sub">...</span>;
  }

  if (!user) {
    return (
      <button
        className="filter-chip"
        onClick={() => signInWithPopup(auth, googleProvider)}
      >
        Google로 로그인
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {isAdmin(user.email) && (
        <Link href="/admin/" className="filter-chip">
          관리자
        </Link>
      )}
      <span className="brand-sub">{user.displayName}</span>
      <button className="filter-chip" onClick={() => signOut(auth)}>
        로그아웃
      </button>
    </div>
  );
}
