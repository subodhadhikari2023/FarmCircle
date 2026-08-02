import type { NextConfig } from "next";
const devOrigin = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).hostname
  : undefined;
const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigin ? [devOrigin] : [],
};
export default nextConfig;
