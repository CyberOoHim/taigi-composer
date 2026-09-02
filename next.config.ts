import type {NextConfig} from 'next';

const isStaticExport = process.env.STATIC_EXPORT === 'true' || process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Static export for GitHub Pages only; Cloud Run uses standard server runtime
  ...(isStaticExport
    ? {
        output: 'export',
        trailingSlash: true,
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
        assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
      }
    : {}),
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['motion'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion', '@google/genai'],
  },
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
