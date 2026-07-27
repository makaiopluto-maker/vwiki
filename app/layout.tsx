import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "버튜버 편성표 | VTuber Info",
  description: "버튜버 방송 플랫폼 링크와 정보를 한곳에서 모아보는 사이트",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
