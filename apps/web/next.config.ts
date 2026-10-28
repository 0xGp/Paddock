import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@splitsense/chain", "@splitsense/engine", "@splitsense/memory"],
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [{ source: "/join/:code", destination: "/app/join/:code", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
