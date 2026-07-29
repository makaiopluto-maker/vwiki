export default function ProfileTable({
  profile,
}: {
  profile?: Record<string, string>;
}) {
  if (!profile || Object.keys(profile).length === 0) return null;

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {Object.entries(profile).map(([label, value], i) => (
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