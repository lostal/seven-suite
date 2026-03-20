import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimización de imágenes
  images: {
    remotePatterns: [],
  },

  // Cabeceras de seguridad
  async headers() {
    // Construir CSP como cadena — cada directiva en línea para legibilidad
    const csp = [
      "default-src 'self'",
      // Scripts: propios + inline necesarios para Next.js (nonce no viable en Edge sin middleware)
      "script-src 'self' 'unsafe-inline'",
      // Estilos: propios + inline (Tailwind, shadcn, framer-motion inyectan estilos en runtime)
      "style-src 'self' 'unsafe-inline'",
      // Imágenes: propio dominio + data URIs + blobs
      "img-src 'self' data: blob:",
      // Fuentes: solo propias
      "font-src 'self'",
      // Conexiones: propio + Microsoft Graph
      "connect-src 'self' https://graph.microsoft.com",
      // Frames bloqueados (X-Frame-Options hace lo mismo, pero CSP cubre iframes incrustados)
      "frame-src 'none'",
      // Manifiestos y workers: solo propios
      "manifest-src 'self'",
      "worker-src 'self' blob:",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
