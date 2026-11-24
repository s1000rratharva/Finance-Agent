import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Proxy /backend/* -> FastAPI so the httpOnly auth cookie stays same-origin.
  // In production set BOTH:
  //   NEXT_PUBLIC_API_URL=/backend                       (browser calls this)
  //   API_UPSTREAM_URL=https://your-api.onrender.com     (Vercel forwards here)
  // Locally, leave API_UPSTREAM_URL unset and use the default API URL.
  async rewrites() {
    const api =
      process.env.API_UPSTREAM_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:8000";
    return [{ source: "/backend/:path*", destination: `${api}/:path*` }];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  },
};

export default nextConfig;
