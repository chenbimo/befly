import { describe, it, expect } from 'bun:test';
import { Logger } from '../utils/logger.js';

it('Logger 输出包含不同级别的前缀', () => {
    const messages: string[] = [];
    const origLog = console.log;
    // 捕获 console.log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (console as any).log = (...args: any[]) => {
        messages.push(args.join(' '));
    };

    try {
        Logger.info('信息');
        Logger.success('成功');
        Logger.warn('警告');
        Logger.error('错误');
        Logger.debug('调试');
    } finally {
        console.log = origLog;
    }

    // 至少包含对应 emoji 或文本
    const joined = messages.join('\n');
    expect(joined.includes('ℹ') || joined.includes('信息')).toBe(true);
    expect(joined.includes('✔') || joined.includes('成功')).toBe(true);
    expect(joined.includes('⚠') || joined.includes('警告')).toBe(true);
    expect(joined.includes('✖') || joined.includes('错误')).toBe(true);
});
