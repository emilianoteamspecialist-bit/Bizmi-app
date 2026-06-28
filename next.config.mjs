/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Next's persistent filesystem cache is flaky on Windows — intermittent
      // "ENOENT: rename '*.pack.gz_' -> '*.pack.gz'" failures corrupt the build
      // and surface as "Cannot read properties of undefined (reading 'call')"
      // and ChunkLoadError. Use the in-memory cache in dev to avoid it.
      config.cache = { type: "memory" }
    }
    return config
  },
}

export default nextConfig