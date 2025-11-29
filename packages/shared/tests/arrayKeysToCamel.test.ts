import { describe, expect, test } from 'bun:test';
import { arrayKeysToCamel } from '../src/arrayKeysToCamel';

describe('arrayKeysToCamel', () => {
    test('should convert array of objects to camelCase', () => {
        const input = [
            { user_id: 1, user_name: 'John' },
            { user_id: 2, user_name: 'Jane' }
        ];
        const expected = [
            { userId: 1, userName: 'John' },
            { userId: 2, userName: 'Jane' }
        ];
        expect(arrayKeysToCamel(input)).toEqual(expected);
    });

    test('should return original if not array', () => {
        expect(arrayKeysToCamel(null as any)).toBeNull();
        expect(arrayKeysToCamel({} as any)).toEqual({});
    });
});
