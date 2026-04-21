// vite.config.js
import { defineConfig } from "file:///C:/Users/Lenovo/Desktop/vibecoding/Restoflow/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.37_terser@5.46.1/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Lenovo/Desktop/vibecoding/Restoflow/node_modules/.pnpm/@vitejs+plugin-react@4.7.0__0f91977cbbfc35fee1fbc14d318afca5/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/Lenovo/Desktop/vibecoding/Restoflow/node_modules/.pnpm/vite-plugin-pwa@0.19.8_vite_a66209d3032da746ce27c15d096a3f2d/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "RestoFlow Customer",
        short_name: "RestoFlow",
        theme_color: "#0f172a",
        background_color: "#020617",
        display: "standalone"
      },
      workbox: { globPatterns: ["**/*.{js,css,html,ico,png,svg}"] }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          state: ["zustand", "idb-keyval"],
          network: ["axios", "socket.io-client"],
          icons: ["lucide-react"]
        }
      }
    }
  },
  server: { port: 3001 }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxMZW5vdm9cXFxcRGVza3RvcFxcXFx2aWJlY29kaW5nXFxcXFJlc3RvZmxvd1xcXFxhcHBzXFxcXGN1c3RvbWVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxMZW5vdm9cXFxcRGVza3RvcFxcXFx2aWJlY29kaW5nXFxcXFJlc3RvZmxvd1xcXFxhcHBzXFxcXGN1c3RvbWVyXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9MZW5vdm8vRGVza3RvcC92aWJlY29kaW5nL1Jlc3RvZmxvdy9hcHBzL2N1c3RvbWVyL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICAgIHBsdWdpbnM6IFtcbiAgICAgICAgcmVhY3QoKSxcbiAgICAgICAgVml0ZVBXQSh7XG4gICAgICAgICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcbiAgICAgICAgICAgIGluamVjdFJlZ2lzdGVyOiAnYXV0bycsXG4gICAgICAgICAgICBtYW5pZmVzdDoge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdSZXN0b0Zsb3cgQ3VzdG9tZXInLFxuICAgICAgICAgICAgICAgIHNob3J0X25hbWU6ICdSZXN0b0Zsb3cnLFxuICAgICAgICAgICAgICAgIHRoZW1lX2NvbG9yOiAnIzBmMTcyYScsXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyMwMjA2MTcnLFxuICAgICAgICAgICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB3b3JrYm94OiB7IGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2Z30nXSB9XG4gICAgICAgIH0pXG4gICAgXSxcbiAgICBidWlsZDoge1xuICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICAgICAgICBtYW51YWxDaHVua3M6IHtcbiAgICAgICAgICAgICAgICAgICAgcmVhY3Q6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcbiAgICAgICAgICAgICAgICAgICAgcXVlcnk6IFsnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5J10sXG4gICAgICAgICAgICAgICAgICAgIHN0YXRlOiBbJ3p1c3RhbmQnLCAnaWRiLWtleXZhbCddLFxuICAgICAgICAgICAgICAgICAgICBuZXR3b3JrOiBbJ2F4aW9zJywgJ3NvY2tldC5pby1jbGllbnQnXSxcbiAgICAgICAgICAgICAgICAgICAgaWNvbnM6IFsnbHVjaWRlLXJlYWN0J10sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHsgcG9ydDogMzAwMSB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBZ1gsU0FBUyxvQkFBb0I7QUFDN1ksT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUN4QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixTQUFTO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDSixjQUFjO0FBQUEsTUFDZCxnQkFBZ0I7QUFBQSxNQUNoQixVQUFVO0FBQUEsUUFDTixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixrQkFBa0I7QUFBQSxRQUNsQixTQUFTO0FBQUEsTUFDYjtBQUFBLE1BQ0EsU0FBUyxFQUFFLGNBQWMsQ0FBQyxnQ0FBZ0MsRUFBRTtBQUFBLElBQ2hFLENBQUM7QUFBQSxFQUNMO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDSCxlQUFlO0FBQUEsTUFDWCxRQUFRO0FBQUEsUUFDSixjQUFjO0FBQUEsVUFDVixPQUFPLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFVBQ2hELE9BQU8sQ0FBQyx1QkFBdUI7QUFBQSxVQUMvQixPQUFPLENBQUMsV0FBVyxZQUFZO0FBQUEsVUFDL0IsU0FBUyxDQUFDLFNBQVMsa0JBQWtCO0FBQUEsVUFDckMsT0FBTyxDQUFDLGNBQWM7QUFBQSxRQUMxQjtBQUFBLE1BQ0o7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUFBLEVBQ0EsUUFBUSxFQUFFLE1BQU0sS0FBSztBQUN6QixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
