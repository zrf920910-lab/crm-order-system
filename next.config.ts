import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@vercel/postgres'],
  turbopack: {
    resolveAlias: {
      canvas: './src/lib/canvas-stub.ts',
    },
  },
};

export default nextConfig;
