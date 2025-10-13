/**
 * Checker 测试
 *
 * 注意：由于测试环境的特殊性，此测试被跳过
 * 在测试环境中，getProjectRoot() 指向 core 目录，
 * 导致项目表路径与核心表路径相同，会触发重复表名错误
 */

import { describe, expect, test } from 'bun:test';
import { Checker } from '../lifecycle/checker.js';

describe.skip('Checker', () => {
    describe('run', () => {
        test('应该成功执行所有检查', async () => {
            // 执行检查
            await expect(Checker.run()).resolves.toBeUndefined();
        });
    });
});
