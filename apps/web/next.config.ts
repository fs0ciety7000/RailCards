import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@railcards/ui", "@railcards/contracts"],
  // Standalone output + an explicit tracing root are required for a correct,
  // minimal production image: this app lives inside a pnpm workspace, so
  // Next's file tracer needs to look above apps/web to find the hoisted
  // dependencies it must copy into .next/standalone.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
