"use client";

import { useEffect, useState } from "react";
import { CommentEntry } from "@/lib/types";
import {
  addComment,
  deleteComment,
  subscribeComments,
  voteComment,
} from "@/lib/comments";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/admin";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

function formatTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(ts);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export default function Comments({ vtuberId }: { vtuberId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeComments(vtuberId, setComments);
    return unsub;
  }, [vtuberId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      await signInWithPopup(auth, googleProvider);
      return;
    }
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await addComment({
        vtuberId,
        uid: user.uid,
        displayName: user.displayName ?? "익명",
        photoURL: user.photoURL,
        text: text.trim(),
      });
      setText("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (c: CommentEntry, value: 1 | -1) => {
    if (!user) {
      await signInWithPopup(auth, googleProvider);
      return;
    }
    const current = c.votes?.[user.uid];
    await voteComment(c.id, user.uid, current === value ? null : value);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          className="filter-chip"
          style={{ flex: 1, cursor: "text" }}
          placeholder={user ? "댓글을 남겨보세요..." : "로그인하고 댓글 남기기"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={submitting}
          className="filter-chip"
          data-active="true"
        >
          등록
        </button>
      </form>

      {comments.length === 0 ? (
        <div className="empty-state" style={{ padding: "24px 0" }}>
          아직 댓글이 없습니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {comments.map((c) => {
            const votes = c.votes ?? {};
            const likeCount = Object.values(votes).filter((v) => v === 1).length;
            const dislikeCount = Object.values(votes).filter((v) => v === -1).length;
            const myVote = user ? votes[user.uid] : undefined;

            return (
              <div
                key={c.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "var(--card)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 4 }}>
                    {c.displayName}
                    {" · "}
                    {formatTime(c.createdAt)}
                  </div>
                  <div style={{ fontSize: 14, marginBottom: 8 }}>{c.text}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      onClick={() => handleVote(c, 1)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12.5,
                        color: myVote === 1 ? "var(--accent)" : "var(--ink-soft)",
                      }}
                    >
                      👍 {likeCount}
                    </button>
                    <button
                      onClick={() => handleVote(c, -1)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12.5,
                        color: myVote === -1 ? "var(--accent)" : "var(--ink-soft)",
                      }}
                    >
                      👎 {dislikeCount}
                    </button>
                  </div>
                </div>
                {user && (user.uid === c.uid || isAdmin(user.email)) && (
                  <button
                    onClick={() => deleteComment(c.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--ink-soft)",
                      cursor: "pointer",
                      fontSize: 12,
                      height: "fit-content",
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
