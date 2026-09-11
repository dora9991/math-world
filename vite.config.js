import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "/" でOK（数学ラボ2のようなサブパス配信はまだ決めていない・#todo）
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5184,
  },
});
