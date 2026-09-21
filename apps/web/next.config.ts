import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@report-platform/database", "@report-platform/shared", "@report-platform/ui"],
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname
};

export default nextConfig;

