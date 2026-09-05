/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for a lean, self-contained Docker image on Cloud Run.
  output: "standalone",
};

module.exports = nextConfig;
