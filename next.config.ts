import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["basinuat.horusai.pro"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "semet.uk",
        pathname: "/loop/**",
      },
    ],
  },
};

export default nextConfig;
