/**
 * 装配块注册表：存放所有可用的块定义。
 * 引擎需要先注册块，然后才能按配置名引用它们。
 */

import type { BlockDef } from "./types.js";

export class BlockRegistry {
  private blocks = new Map<string, BlockDef>();

  register(block: BlockDef, opts?: { silent?: boolean }): void {
    if (this.blocks.has(block.name) && !opts?.silent) {
      console.warn(
        `[BlockRegistry] 块 "${block.name}" 已存在，将被覆盖。` +
        `若有意覆盖请使用 register(block, { silent: true }) 消除此警告。`,
      );
    }
    this.blocks.set(block.name, block);
  }

  get(name: string): BlockDef | undefined {
    return this.blocks.get(name);
  }

  has(name: string): boolean {
    return this.blocks.has(name);
  }

  listNames(): string[] {
    return [...this.blocks.keys()];
  }
}
