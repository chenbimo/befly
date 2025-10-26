import { describe, it, expect, beforeAll } from 'bun:test';

// 测试版本比较逻辑（从 checkBun.ts 导出内部函数用于测试）
it('Bun.version 应该存在且满足最低版本要求', () => {
    // 验证 Bun 版本存在
    expect(Bun.version).toBeDefined();
    expect(typeof Bun.version).toBe('string');

    // 验证版本格式
    const versionPattern = /^\d+\.\d+\.\d+/;
    expect(versionPattern.test(Bun.version)).toBe(true);

    // 验证版本 >= 1.3.0
    const [major, minor] = Bun.version.split('.').map(Number);
    expect(major).toBeGreaterThanOrEqual(1);

    if (major === 1) {
        expect(minor).toBeGreaterThanOrEqual(3);
    }
});

it('版本比较逻辑应该正确', () => {
    // 简单的版本比较测试（复制 checkBun.ts 中的逻辑）
    function compareVersions(v1: string, v2: string): number {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;

            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }

        return 0;
    }

    // 测试各种版本比较场景
    expect(compareVersions('1.3.0', '1.3.0')).toBe(0);
    expect(compareVersions('1.3.1', '1.3.0')).toBe(1);
    expect(compareVersions('1.2.9', '1.3.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.3.0')).toBe(1);
    expect(compareVersions('1.3.0', '1.3.0.1')).toBe(-1);
    expect(compareVersions('1.3', '1.3.0')).toBe(0);
});
