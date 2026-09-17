import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 2026-09-18：GitHub Pagesでのデプロイ先が https://dora9991.github.io/math-world/
// というサブパスになるため、本番ビルドだけbaseをそこに合わせる（.github/workflows/
// deploy.yml参照）。ローカル開発(npm run dev)は今まで通りルート("/")のまま。
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/math-world/" : "/",
  server: {
    port: 5184,
  },
}));
