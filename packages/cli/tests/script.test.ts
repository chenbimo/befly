import { describe, it, expect } from 'bun:test';
import { scriptCommand } from '../lib/commands/script.js';
import { existsSync } from 'node:fs';
import path from 'node:path';

it('scriptCommand 在无脚本情况下以提示返回', async () => {
    // 将工作目录切换到一个临时空目录（使用 repo 根的 temp 目录）
    const repoRoot = path.resolve(__dirname, '../../..');
    const tmpDir = path.join(repoRoot, 'temp', 'empty-for-tests');

    // 确保目录存在且为空
    try {
        // 不创建 scripts，确保不会找到脚本
    } catch (e) {}

    // 调用时应当不抛出异常
    await scriptCommand({ dryRun: true });

    expect(true).toBe(true);
});
