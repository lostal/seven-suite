import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Optimización de imágenes
  images: {
    remotePatterns: [],
  },

  // Cabeceras de seguridad
  async headers() {
    const isDevelopment = process.env.NODE_ENV === "development";
    // Construir CSP como cadena — cada directiva en línea para legibilidad
    const csp = [
      "default-src 'self'",
      // Scripts: propios + inline necesarios para Next.js (y eval solo en dev mode para Turbopack/React)
      `script-src 'self' 'unsafe-inline' ${isDevelopment ? "'unsafe-eval'" : ""}`,
      // Estilos: propios + inline (Tailwind, shadcn, framer-motion inyectan estilos en runtime)
      "style-src 'self' 'unsafe-inline'",
      // Imágenes: propio dominio + data URIs + blobs
      "img-src 'self' data: blob:",
      // Fuentes: solo propias
      "font-src 'self'",
      // Conexiones: propio + Microsoft Graph
      `connect-src 'self' https://graph.microsoft.com${
        isDevelopment ? " ws: wss:" : ""
      }`,
      // Frames bloqueados (X-Frame-Options hace lo mismo, pero CSP cubre iframes incrustados)
      "frame-src 'none'",
      // Manifiestos y workers: solo propios
      "manifest-src 'self'",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
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
          ...(!isDevelopment
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
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
