import path from "node:path";
import type { NextConfig } from "next";

// Uploaded card/booster images (apps/api/src/storage) are served from the
// API's own origin, separate from this app — next/image refuses any host
// not explicitly allow-listed here, so it's derived from the same build-time
// var that already points the client at the API.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const apiUrl = apiBaseUrl ? new URL(apiBaseUrl) : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@railcards/ui", "@railcards/contracts"],
  // Standalone output + an explicit tracing root are required for a correct,
  // minimal production image: this app lives inside a pnpm workspace, so
  // Next's file tracer needs to look above apps/web to find the hoisted
  // dependencies it must copy into .next/standalone.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    remotePatterns: apiUrl
      ? [{ protocol: apiUrl.protocol.replace(":", "") as "http" | "https", hostname: apiUrl.hostname, port: apiUrl.port }]
      : [],
  },
};

export default nextConfig;
