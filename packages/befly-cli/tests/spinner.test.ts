import { it, expect } from 'bun:test';
import { Spinner } from '../lib/utils/spinner.js';

it('Spinner.start 返回对象并有 succeed 方法', () => {
    const spinner = Spinner.start('测试');
    expect(spinner).toBeDefined();
    expect(typeof spinner.succeed).toBe('function');
    // 尽量停止 spinner
    try {
        spinner.succeed('完成');
    } catch (e) {
        // ignore
    }
});
