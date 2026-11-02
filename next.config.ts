import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1mb, which rejects ordinary phone photos. Vercel caps request
      // bodies at about 4.5mb, so going higher than this would not help there.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
