/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@google/genai', 'googleapis', 'cheerio', 'web-push', 'pg'],
  },
};

export default nextConfig;
