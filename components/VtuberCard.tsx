import Link from "next/link";
import { VtuberEntry } from "@/lib/types";
import PlatformLinks from "./PlatformLinks";
import FavoriteButton from "./FavoriteButton";

const STATUS_LABEL: Record<VtuberEntry["status"], string> = {
  active: "ACTIVE",
  hiatus: "HIATUS",
  graduated: "GRADUATED",
};

export default function VtuberCard({
  vtuber,
  favorited = false,
}: {
  vtuber: VtuberEntry;
  favorited?: boolean;
}) {
  return (
    <div className="card" style={{ ["--card-accent" as any]: vtuber.color }}>
      <div className="card-top">
        <Link href={`/vtuber/?id=${vtuber.id}`} style={{ flex: 1 }}>
          <div className="card-name">{vtuber.name}</div>
          <div className="card-agency">{vtuber.agency}</div>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FavoriteButton vtuberId={vtuber.id} favorited={favorited} />
          <span className="status-badge">{STATUS_LABEL[vtuber.status]}</span>
        </div>
      </div>
      <Link href={`/vtuber/?id=${vtuber.id}`}>
        <div className="card-tags">
          {vtuber.tags.map((tag) => (
            <span className="tag" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
      </Link>
      <PlatformLinks platforms={vtuber.platforms} />
      <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--ink-soft)" }}>
        조회 {vtuber.views ?? 0}
      </div>
    </div>
  );
}
