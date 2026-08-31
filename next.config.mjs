/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The deck visual-QA route (app/api/generate/presentation) launches
    // serverless Chrome via @sparticuz/chromium; its brotli-packed binary
    // lives outside the normal import graph, so trace it into that function.
    outputFileTracingIncludes: {
      "/api/generate/presentation": ["./node_modules/@sparticuz/chromium/bin/**"],
    },
  },
};

export default nextConfig;
