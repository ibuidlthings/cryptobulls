/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output bundles all transitive deps + .next/ into a single
  // self-contained server folder. Lets us deploy with just `node server.js`
  // on the bulls box, no full npm install needed.
  output: "standalone",
  reactStrictMode: true,
  // The renderer is plain ESM (.mjs) imported from /lib. Next/Webpack
  // already handles .mjs natively for app router; nothing extra needed.
  experimental: {
    // Allow API routes to read solana account data on the server
    // without static rendering trying to pre-render them at build time.
  },
};

module.exports = nextConfig;
