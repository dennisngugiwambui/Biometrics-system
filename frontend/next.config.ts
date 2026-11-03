import withPWAInit from "@ducanh2912/next-pwa";
import path from "node:path";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Self-contained server bundle (.next/standalone) for the cPanel deploy — see deploy/
  output: "standalone",
  // This folder is the project root (a stray lockfile in the parent confuses inference)
  outputFileTracingRoot: path.join(__dirname),
  devIndicators: ({
    buildActivity: false,
    buildActivityPosition: "bottom-right",
  } as unknown) as NextConfig["devIndicators"],
  // Required: empty turbopack config prevents conflict warning with next-pwa webpack config
  turbopack: { root: path.join(__dirname) },
};

export default withPWA(nextConfig);
