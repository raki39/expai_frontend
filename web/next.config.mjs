/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` so no build do Dockerfile (ver Dockerfile, estagio builder).
  // A Vercel constroi com o pipeline proprio e nao deve receber esta opcao.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
