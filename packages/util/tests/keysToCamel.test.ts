import { describe, expect, test } from 'bun:test';
import { keysToCamel } from '../src/keysToCamel';

describe('keysToCamel', () => {
    test('should convert keys to camelCase', () => {
        const input = { user_id: 123, user_name: 'John' };
        const expected = { userId: 123, userName: 'John' };
        expect(keysToCamel(input)).toEqual(expected);
    });

    test('should handle nested objects (shallow)', () => {
        const input = { user_info: { first_name: 'John' } };
        const expected = { userInfo: { first_name: 'John' } };
        expect(keysToCamel(input)).toEqual(expected);
    });

    test('should return original if not plain object', () => {
        expect(keysToCamel(null as any)).toBeNull();
        expect(keysToCamel(undefined as any)).toBeUndefined();
        expect(keysToCamel('string' as any)).toBe('string');
    });
});
