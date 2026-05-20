import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next-runtime",
  turbopack: {},

  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      path: false,
    };

    return config;
  },
};

export default nextConfig;
