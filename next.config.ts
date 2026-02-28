import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // Exclude chromadb from serverless bundles (local dev only)
  serverExternalPackages: ['chromadb', '@chroma-core/default-embed'],
};

export default nextConfig;
