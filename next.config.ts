
import type {NextConfig} from 'next';
import path from 'path';
import WorkboxWebpackPlugin from 'workbox-webpack-plugin';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'blogger.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
        port: '',
        pathname: '/**',
      },
      // Allow image previews from various sources
      {
        protocol: 'https',
        hostname: '**.google.com',
      },
       {
        protocol: 'https',
        hostname: '**.cdn.vox-cdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.youtube.com',
      },
      {
        protocol: 'https',
        hostname: '**.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: '**.github.com',
      },
       {
        protocol: 'https',
        hostname: '**.githubusercontent.com',
      },
    ],
  },
   webpack: (config, { isServer }) => {
    if (!isServer) {
        config.plugins.push(
            new WorkboxWebpackPlugin.InjectManifest({
                swSrc: path.join(__dirname, 'public', 'firebase-messaging-sw.js'),
                swDest: path.join(__dirname, 'public', 'sw.js'),
                // Ensure the service worker is loaded correctly.
                exclude: [
                    /\.map$/,
                    /manifest\.json$/,
                    /firebase-messaging-sw\.js$/, // Exclude the source sw file itself
                ],
            })
        );
    }
    return config;
  },
};

export default nextConfig;
