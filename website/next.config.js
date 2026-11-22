/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure API routes are available
  images: {
    domains: [],
  },
};

module.exports = nextConfig;