import withPWAInit from "@ducanh2912/next-pwa";
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
  devIndicators: ({
    buildActivity: false,
    buildActivityPosition: "bottom-right",
  } as unknown) as NextConfig["devIndicators"],
  // Required: empty turbopack config prevents conflict warning with next-pwa webpack config
  turbopack: {},
};

export default withPWA(nextConfig);
