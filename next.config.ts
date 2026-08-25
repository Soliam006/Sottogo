import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Avatares y portadas remotas. Ajusta a tu dominio de Supabase Storage.
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default nextConfig;
