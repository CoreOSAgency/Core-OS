/** @type {import('next').NextConfig} */
const nextConfig = {
  // The deck PDF export (app/api/decks/[shareToken]/pdf) launches serverless
  // Chrome via @sparticuz/chromium. Keep both packages external so the bundler
  // doesn't mangle the native binary resolution...
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
    // ...and trace the brotli-packed Chromium binary, which lives outside the
    // import graph, into that function.
    outputFileTracingIncludes: {
      "/api/decks/[shareToken]/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    },
  },
};

export default nextConfig;
