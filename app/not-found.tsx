import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container">
      <div className="empty-state">
        페이지를 찾을 수 없습니다.
        <br />
        <br />
        <Link href="/" className="back-link">
          ← 전체 목록으로
        </Link>
      </div>
    </main>
  );
}
