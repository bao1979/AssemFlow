/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// 最简 Vite 配置：根目录即实验根，浏览器入口为 index.html → src/main.ts。
// vitest 测试默认 node 环境；需要浏览器 DOM 的测试（如 render.test.ts）
// 在文件头部用 `// @vitest-environment jsdom` 单独声明，保持配置最小。
export default defineConfig({
  test: {
    environment: "node",
  },
});
