/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  webpack(config, { isServer }) {
    if (!isServer && config.output) {
      config.output.filename = "static/chunks/[id].js";
      config.output.chunkFilename = "static/chunks/[id].js";
      config.output.assetModuleFilename = "static/media/[name][ext]";
    }
    return config;
  },
};

export default nextConfig;
