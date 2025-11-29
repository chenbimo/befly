import { describe, expect, test } from 'bun:test';
import { calcPerfTime } from '../src/calcPerfTime';

describe('calcPerfTime', () => {
    test('should return milliseconds for short duration', () => {
        const start = Bun.nanoseconds();
        // Simulate small delay
        const end = start + 500_000; // 0.5ms
        const result = calcPerfTime(start, end);
        expect(result).toMatch(/毫秒$/);
    });

    test('should return seconds for long duration', () => {
        const start = Bun.nanoseconds();
        const end = start + 2_000_000_000; // 2s
        const result = calcPerfTime(start, end);
        expect(result).toMatch(/秒$/);
    });
});
