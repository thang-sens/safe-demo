import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable polyfills for specific globals and modules
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Enable polyfills for Node.js built-in modules
      protocolImports: true,
    }),
  ],
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      // Explicit polyfills for Node.js modules
      stream: "stream-browserify",
      crypto: "crypto-browserify",
      http: "stream-http",
      https: "https-browserify",
      zlib: "browserify-zlib",
      url: "url",
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: "globalThis",
      },
    },
    include: [
      "@web3auth/modal",
      "@web3auth/base",
      "@web3auth/ethereum-provider",
      "ethers",
      "buffer",
      "process",
      "react",
      "react-dom",
    ],
    exclude: [],
  },
});
