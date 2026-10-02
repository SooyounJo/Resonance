/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: {
    position: "bottom-right",
  },
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
