const FIELD_ORDER = [
  "성별",
  "종족",
  "나이",
  "생일",
  "신장",
  "반려동물",
  "반려묘",
  "반려견",
  "MBTI",
  "소속",
  "디자인",
  "Live2D",
  "오시마크",
  "팬네임",
  "데뷔",
];

export default function ProfileTable({
  profile,
}: {
  profile?: Record<string, string>;
}) {
  if (!profile || Object.keys(profile).length === 0) return null;

  const entries = Object.entries(profile).sort(([a], [b]) => {
    const ai = FIELD_ORDER.indexOf(a);
    const bi = FIELD_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {entries.map(([label, value], i) => (
        <div
          key={label}
          style={{
            display: "flex",
            borderTop: i === 0 ? "none" : "1px solid var(--line)",
          }}
        >
          <div
            style={{
              width: 96,
              flexShrink: 0,
              padding: "9px 12px",
              background: "var(--paper-alt)",
              fontSize: 12.5,
              color: "var(--ink-soft)",
            }}
          >
            {label}
          </div>
          <div
            style={{
              padding: "9px 12px",
              fontSize: 13.5,
              background: "var(--card)",
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}