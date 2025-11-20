import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { scanFiles } from '../src/scanFiles';

const TEST_DIR = join(process.cwd(), 'temp_test_scanFiles');

describe('scanFiles', () => {
    beforeAll(() => {
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true, force: true });
        }
        mkdirSync(TEST_DIR, { recursive: true });

        // Create test files
        writeFileSync(join(TEST_DIR, 'a.ts'), '');
        writeFileSync(join(TEST_DIR, 'b.js'), '');
        writeFileSync(join(TEST_DIR, 'c.txt'), ''); // Should be ignored by default pattern
        writeFileSync(join(TEST_DIR, '_ignored.ts'), ''); // Should be ignored by ignoreUnderline

        mkdirSync(join(TEST_DIR, 'sub'));
        writeFileSync(join(TEST_DIR, 'sub/d.ts'), '');

        mkdirSync(join(TEST_DIR, '_sub_ignored'));
        writeFileSync(join(TEST_DIR, '_sub_ignored/e.ts'), ''); // Should be ignored by ignoreUnderline
    });

    afterAll(() => {
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true, force: true });
        }
    });

    it('should scan ts and js files by default', async () => {
        const files = await scanFiles(TEST_DIR);
        const fileNames = files.map((f) => f.fileName).sort();
        expect(fileNames).toEqual(['a', 'b', 'd']);
    });

    it('should respect custom pattern', async () => {
        const files = await scanFiles(TEST_DIR, '**/*.txt');
        const fileNames = files.map((f) => f.fileName).sort();
        expect(fileNames).toEqual(['c']);
    });

    it('should include underline files when ignoreUnderline is false', async () => {
        const files = await scanFiles(TEST_DIR, '**/*.{ts,js}', false);
        const fileNames = files.map((f) => f.fileName).sort();
        expect(fileNames).toEqual(['_ignored', 'a', 'b', 'd', 'e']);
    });

    it('should return correct relative paths', async () => {
        const files = await scanFiles(TEST_DIR);
        const dFile = files.find((f) => f.fileName === 'd');
        expect(dFile).toBeDefined();
        expect(dFile?.relativePath).toBe('sub/d');
    });
});
