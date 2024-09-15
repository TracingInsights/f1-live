/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  compiler: {
    styledComponents: true,
  },
  output: 'export',
  images: {
    unoptimized: true
  },
};

module.exports = nextConfig;
