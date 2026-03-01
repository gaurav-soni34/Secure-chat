import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Rewrites to handle API routing transparently
  // This ensures API calls stay within the same origin, avoiding CORS issues
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: "/api/:path*",
        },
      ],
    };
  },
  
  // Ensure proper headers for cross-device access
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Cookie, x-auth-token",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
