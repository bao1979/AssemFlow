/// <reference types="vite/client" />

// Vite 的 `?raw` 后缀导入：把任意文件作为字符串原样引入。
// vite/client 已声明 "*?raw" 模块，这里再显式兜底一份，确保 tsc（非 Vite 流程）
// 在 typecheck 时也能识别 level-push-1.txt?raw / walk.jsonc?raw 这类导入。
declare module "*?raw" {
  const content: string;
  export default content;
}
