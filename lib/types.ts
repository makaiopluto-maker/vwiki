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
  color: string;
  platforms: Partial<Record<Platform, string>>;
  views?: number;
  namu: {
    url: string;
    excerpt: string;
    fetchedAt: string | null;
    profile?: Record<string, string>;
  };
}

export interface CommentEntry {
  id: string;
  vtuberId: string;
  uid: string;
  displayName: string;
  photoURL?: string | null;
  text: string;
  createdAt: number;
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
  createdAt: number;
}