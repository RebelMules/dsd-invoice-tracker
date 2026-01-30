/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable edge runtime for faster API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Allow larger invoice uploads
    },
  },
}

module.exports = nextConfig
