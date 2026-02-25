import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Work around Turbopack root auto-detection bugs on some project layouts.
    root: process.cwd(),
  },
};

export default nextConfig;
