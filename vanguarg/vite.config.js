import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function forwardSite(proxy) {
  proxy.on("proxyReq", (proxyReq, req) => {
    if (req.headers.host) proxyReq.setHeader("x-forwarded-host", req.headers.host);
    proxyReq.setHeader("x-forwarded-proto", "http");
  });
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
      "/sitemap.xml": {
        target: "http://localhost:3001",
        changeOrigin: true,
        configure: forwardSite,
      },
      "/robots.txt": {
        target: "http://localhost:3001",
        changeOrigin: true,
        configure: forwardSite,
      },
    },
  },
})
