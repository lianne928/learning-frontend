import { defineConfig } from "vite";

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ["color-functions", "import", "global-builtin", "if-function"],
      },
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    // 透過 ngrok / LAN 存取時，讓 HMR WebSocket 自動跟隨瀏覽器 host
    // 若只在本機開發可改回 { host: 'localhost', protocol: 'ws' }
    hmr: true,
    proxy: {
      '^/(api|uploads)': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
