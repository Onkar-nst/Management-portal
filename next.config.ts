import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root (a stray package-lock.json in the home folder confuses auto-detection).
  outputFileTracingRoot: __dirname,
  devIndicators: false,
};

export default nextConfig;
