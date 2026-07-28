export type Platform =
  | "youtube"
  | "chzzk"
  | "twitch"
  | "twitter"
  | "afreeca"
  | "instagram";

export interface VtuberEntry {
  id: string;
  name: string;
  nameEn?: string;
  agency: string;
  debutDate?: string;
  status: "active" | "graduated" | "hiatus";
  tags: string[];
  avatar?: string;
  color: string; // 멤버 테마 컬러 (hex) - 카드 포인트에 사용
  platforms: Partial<Record<Platform, string>>;
  views?: number;
  namu: {
    url: string;
    excerpt: string;
    fetchedAt: string | null;
    profile?: Record<string, string>; // 성별/나이/생일 등 사실 정보 (표 형태)
  };
}

export interface CommentEntry {
  id: string;
  vtuberId: string;
  uid: string;
  displayName: string;
  photoURL?: string | null;
  text: string;
  createdAt: number; // epoch ms
  votes?: Record<string, 1 | -1>;
}

export interface RequestEntry {
  id: string;
  uid: string;
  displayName: string;
  name: string;
  agency?: string;
  youtube?: string;
  chzzk?: string;
  twitch?: string;
  twitter?: string;
  namuUrl?: string;
  note?: string;
  createdAt: number; // epoch ms
}