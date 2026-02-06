import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // Hide the Turbopack/Next.js dev indicator
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
