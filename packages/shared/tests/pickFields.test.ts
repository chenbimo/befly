import { describe, expect, test } from 'bun:test';
import { pickFields } from '../src/pickFields';

describe('pickFields', () => {
    test('should pick specified fields', () => {
        const input = { a: 1, b: 2, c: 3 };
        const keys = ['a', 'c'];
        const expected = { a: 1, c: 3 };
        expect(pickFields(input, keys)).toEqual(expected);
    });

    test('should ignore non-existent keys', () => {
        const input = { a: 1 };
        const keys = ['a', 'b'];
        const expected = { a: 1 };
        expect(pickFields(input, keys)).toEqual(expected);
    });

    test('should return empty object for invalid input', () => {
        expect(pickFields(null as any, ['a'])).toEqual({});
    });
});
