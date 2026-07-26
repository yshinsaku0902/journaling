/** @type {import('next').NextConfig} */
const nextConfig = {
  // Service Worker / manifest は public 配下で配信
  // TypeScript 7(ネイティブCLI)を使うための設定
  experimental: {
    useTypeScriptCli: true,
  },
};

export default nextConfig;
