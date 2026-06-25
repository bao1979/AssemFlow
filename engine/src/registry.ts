/**
 * 装配块注册表：存放所有可用的块定义。
 * 引擎需要先注册块，然后才能按配置名引用它们。
 */

import type { BlockDef } from "./types.js";

export class BlockRegistry {
  private blocks = new Map<string, BlockDef>();

  register(block: BlockDef): void {
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
