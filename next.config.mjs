/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // GitHub 저장소 이름이 "vwiki"라서 아래 값으로 맞춰져 있습니다.
  // 저장소 이름을 바꾸면 이 값도 그 이름으로 바꿔주세요.
  // 커스텀 도메인(예: xxx.한국)을 연결하면 이 줄은 빈 문자열("")로 바꾸거나 지우세요.
  basePath: "/vwiki",
};

export default nextConfig;
