import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/data";
import { Platform } from "@/lib/types";

export default function PlatformLinks({
  platforms,
}: {
  platforms: Partial<Record<Platform, string>>;
}) {
  const entries = Object.entries(platforms) as [Platform, string][];

  if (entries.length === 0) {
    return <span style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>등록된 링크 없음</span>;
  }

  return (
    <div className="platform-row">
      {entries.map(([platform, url]) => (
        <a
          key={platform}
          className="platform-btn"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span
            className="platform-dot"
            style={{ background: PLATFORM_COLORS[platform] ?? "#888" }}
          />
          {PLATFORM_LABELS[platform] ?? platform}
        </a>
      ))}
    </div>
  );
}
