import { VtuberEntry } from "@/lib/types";

export default function NamuExcerpt({ namu }: { namu: VtuberEntry["namu"] }) {
  return (
    <div className="namu-box">
      {namu.excerpt ? (
        <p className="namu-excerpt">{namu.excerpt}</p>
      ) : (
        <p className="namu-excerpt" style={{ color: "var(--ink-soft)" }}>
          아직 발췌를 불러오지 않았습니다. (GitHub Actions가 다음 스케줄에 자동으로 채웁니다)
        </p>
      )}
      <div className="namu-footer">
        <span>
          CC BY-NC-SA 2.0 KR
          {namu.fetchedAt ? ` · ${namu.fetchedAt} 기준` : ""}
        </span>
        <a href={namu.url} target="_blank" rel="noopener noreferrer">
          나무위키 원문 보기 →
        </a>
      </div>
    </div>
  );
}
