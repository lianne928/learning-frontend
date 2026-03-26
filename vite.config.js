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
    proxy: {
      '^/(api|uploads)': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
});
