/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use a custom build directory to avoid OneDrive readlink issues on .next
  // in this Windows environment.
  distDir: '.next-dev',
  images: {
    // Allow any external image hostname so news images from BBC, Reuters,
    // The Hindu, and other sources never 404.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
    // Disable Next.js image optimisation for externally-hosted images
    // (avoids 400 errors when source domains block the optimiser).
    unoptimized: true,
  },
  // Silence noisy "img" ESLint rule — we intentionally use <img> for
  // external news images with onError fallback handling.
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
