import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Supabase is contacted directly from the browser, so its origin has to be
// allowed explicitly rather than left to a wildcard.
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "";
  } catch {
    return "";
  }
})();

/**
 * Content Security Policy.
 *
 * Honest caveat: every page in this app styles itself with inline `style`
 * attributes and inline <style> blocks, and Next injects inline bootstrap
 * scripts, so 'unsafe-inline' is required for both until that is reworked with
 * nonces. Everything else is locked down — in particular `object-src 'none'`,
 * `frame-ancestors 'none'` and a `connect-src` that only reaches this origin
 * and Supabase. `unsafe-eval` is dev-only, where the bundler needs it.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Avatars are served from Supabase storage, so that origin has to be allowed
  // here too — without it the browser silently blocks the image and the
  // profile picture sits there loading forever.
  `img-src 'self' data: blob: https://image.tmdb.org${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${
    isDev ? " ws://localhost:* http://localhost:*" : ""
  }`,
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Clickjacking: frame-ancestors above covers modern browsers, this covers old ones.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Only meaningful over HTTPS; harmless on localhost.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Proxied posters are immutable per URL and safe to cache hard.
        source: "/api/proxy-image",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Disposition", value: "inline" },
        ],
      },
    ];
  },
};

export default nextConfig;
