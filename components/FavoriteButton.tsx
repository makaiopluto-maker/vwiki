"use client";

import { useAuth } from "@/hooks/useAuth";
import { setFavorite } from "@/lib/favorites";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export default function FavoriteButton({
  vtuberId,
  favorited,
}: {
  vtuberId: string;
  favorited: boolean;
}) {
  const { user } = useAuth();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      await signInWithPopup(auth, googleProvider);
      return;
    }
    await setFavorite(user.uid, vtuberId, !favorited);
  };

  return (
    <button
      onClick={handleClick}
      aria-label="즐겨찾기"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: 18,
        color: favorited ? "var(--accent)" : "var(--ink-soft)",
        lineHeight: 1,
      }}
    >
      {favorited ? "★" : "☆"}
    </button>
  );
}
