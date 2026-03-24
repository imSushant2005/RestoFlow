// vite.config.ts
import { defineConfig } from "file:///C:/Users/Lenovo/Desktop/vibecoding/dineflow/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.37_terser@5.46.1/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Lenovo/Desktop/vibecoding/dineflow/node_modules/.pnpm/@vitejs+plugin-react@4.7.0__0f91977cbbfc35fee1fbc14d318afca5/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/Lenovo/Desktop/vibecoding/dineflow/node_modules/.pnpm/vite-plugin-pwa@0.19.8_vite_a66209d3032da746ce27c15d096a3f2d/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: { globPatterns: ["**/*.{js,css,html,ico,png,svg}"] }
    })
  ],
  server: { port: 3001 }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxMZW5vdm9cXFxcRGVza3RvcFxcXFx2aWJlY29kaW5nXFxcXGRpbmVmbG93XFxcXGFwcHNcXFxcY3VzdG9tZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXExlbm92b1xcXFxEZXNrdG9wXFxcXHZpYmVjb2RpbmdcXFxcZGluZWZsb3dcXFxcYXBwc1xcXFxjdXN0b21lclxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvTGVub3ZvL0Rlc2t0b3AvdmliZWNvZGluZy9kaW5lZmxvdy9hcHBzL2N1c3RvbWVyL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXG4gICAgICBpbmplY3RSZWdpc3RlcjogJ2F1dG8nLFxuICAgICAgd29ya2JveDogeyBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmd9J10gfVxuICAgIH0pXG4gIF0sXG4gIHNlcnZlcjogeyBwb3J0OiAzMDAxIH1cbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTZXLFNBQVMsb0JBQW9CO0FBQzFZLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFFeEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZ0JBQWdCO0FBQUEsTUFDaEIsU0FBUyxFQUFFLGNBQWMsQ0FBQyxnQ0FBZ0MsRUFBRTtBQUFBLElBQzlELENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxRQUFRLEVBQUUsTUFBTSxLQUFLO0FBQ3ZCLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
