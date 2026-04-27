/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standard build directory for Vercel; the .next-dev was for local OneDrive workaround
  distDir: process.env.VERCEL ? '.next' : '.next-dev',
  images: {
    // Restrict to known news source domains for better performance and security
    remotePatterns: [
      { protocol: 'https', hostname: '*.unsplash.com' },
      { protocol: 'https', hostname: 'unsplash.com' },
      { protocol: 'https', hostname: 'ichef.bbci.co.uk' },
      { protocol: 'https', hostname: 'www.bbc.com' },
      { protocol: 'https', hostname: 'bbc.com' },
      { protocol: 'https', hostname: 'www.thehindu.com' },
      { protocol: 'https', hostname: 'thehindu.com' },
      { protocol: 'https', hostname: 'www.reuters.com' },
      { protocol: 'https', hostname: 'reuters.com' },
    ],
    // Enable image optimization for better performance
    unoptimized: process.env.NODE_ENV === 'development',
  },
  // Enable ESLint during builds — catch errors early
  eslint: {
    dirs: ['app', 'components', 'lib'],
    ignoreDuringBuilds: false,
  },
}

export default nextConfig
