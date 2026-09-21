import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@railcards/ui", "@railcards/contracts"],
};

export default nextConfig;
