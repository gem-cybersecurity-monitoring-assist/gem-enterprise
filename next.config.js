// GEM Build: 2026-07-13 public claims control
/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  // Local dev only: lets Turbopack follow a node_modules symlink that lives
  // outside the project directory. Unset in Vercel builds.
  ...(process.env.NEXT_DEV_TURBOPACK_ROOT
    ? { turbopack: { root: process.env.NEXT_DEV_TURBOPACK_ROOT } }
    : {}),

  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-toggle',
      '@radix-ui/react-tooltip',
    ],
  },

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    unoptimized: false,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  compress: true,
  productionBrowserSourceMaps: false,

  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 5,
  },

  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vitals.vercel-insights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-src 'self' https:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },

  async redirects() {
    return [
      { source: '/blog', destination: '/resources', permanent: true },
      {
        source: '/community',
        destination: '/hub',
        permanent: false,
      },
      {
        source: '/community-hub',
        destination: '/hub',
        permanent: false,
      },
      {
        source: '/enterprise-demo',
        destination: '/enterprise-solutions',
        permanent: false,
      },
      {
        source: '/enterprise-demo/watch',
        destination: '/enterprise-solutions',
        permanent: false,
      },
      {
        source: '/preview',
        destination: '/company',
        permanent: false,
      },
      {
        source: '/tokmetric/review-demo',
        destination: '/tokmetric/app-review',
        permanent: false,
      },
      {
        source: '/register',
        destination: '/get-started',
        permanent: true,
      },
      {
        source: '/command-center',
        destination: '/app/command-center',
        permanent: false,
      },
      {
        source: '/admin-command',
        destination: '/app/command-center',
        permanent: false,
      },
    ];
  },

  async rewrites() {
    return {
      beforeFiles: [
        { source: '/hub', destination: '/hub-controlled' },
        { source: '/company', destination: '/company-controlled' },
        { source: '/request-access', destination: '/request-access-controlled' },
      ],
      afterFiles: [],
    };
  },

  typescript: {
    tsconfigPath: './tsconfig.json',
  },
};

module.exports = nextConfig;
