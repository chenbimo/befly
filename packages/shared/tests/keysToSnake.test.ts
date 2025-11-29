import { describe, expect, test } from 'bun:test';
import { keysToSnake } from '../src/keysToSnake';

describe('keysToSnake', () => {
    test('should convert keys to snake_case', () => {
        const input = { userId: 123, userName: 'John' };
        const expected = { user_id: 123, user_name: 'John' };
        expect(keysToSnake(input)).toEqual(expected);
    });

    test('should handle nested objects (shallow)', () => {
        const input = { userInfo: { firstName: 'John' } };
        const expected = { user_info: { firstName: 'John' } };
        expect(keysToSnake(input)).toEqual(expected);
    });

    test('should return original if not plain object', () => {
        expect(keysToSnake(null as any)).toBeNull();
        expect(keysToSnake(undefined as any)).toBeUndefined();
        expect(keysToSnake('string' as any)).toBe('string');
    });
});
