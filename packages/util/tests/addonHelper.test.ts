import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { join } from 'pathe';
import { mkdirSync, rmdirSync, writeFileSync, rmSync } from 'node:fs';
import { scanAddons, getAddonDir, addonDirExists } from '../src/addonHelper';

const TEST_DIR = join(process.cwd(), 'temp_test_addonHelper');
const NODE_MODULES_DIR = join(TEST_DIR, 'node_modules');
const BEFLY_ADDON_DIR = join(NODE_MODULES_DIR, '@befly-addon');
// const LOCAL_ADDONS_DIR = join(TEST_DIR, 'addons');

describe('addonHelper', () => {
    beforeAll(() => {
        // Setup test directories
        if (!require('fs').existsSync(TEST_DIR)) {
            mkdirSync(TEST_DIR, { recursive: true });
        }
        mkdirSync(BEFLY_ADDON_DIR, { recursive: true });
        // mkdirSync(LOCAL_ADDONS_DIR, { recursive: true });

        // Create dummy addons
        mkdirSync(join(BEFLY_ADDON_DIR, 'test-addon-1'), { recursive: true });
        mkdirSync(join(BEFLY_ADDON_DIR, 'test-addon-1', 'api'), { recursive: true });

        mkdirSync(join(BEFLY_ADDON_DIR, 'test-addon-2'), { recursive: true });
    });

    afterAll(() => {
        // Cleanup
        rmSync(TEST_DIR, { recursive: true, force: true });
    });

    test('scanAddons should find addons in node_modules', () => {
        const addons = scanAddons(TEST_DIR);
        expect(addons).toContain('test-addon-1');
        expect(addons).toContain('test-addon-2');
    });

    test('getAddonDir should return correct path', () => {
        const dir = getAddonDir('test-addon-1', 'api', TEST_DIR);
        expect(dir).toBe(join(BEFLY_ADDON_DIR, 'test-addon-1', 'api'));
    });

    test('addonDirExists should return true for existing dir', () => {
        const exists = addonDirExists('test-addon-1', 'api', TEST_DIR);
        expect(exists).toBe(true);
    });

    test('addonDirExists should return false for non-existing dir', () => {
        const exists = addonDirExists('test-addon-1', 'non-existent', TEST_DIR);
        expect(exists).toBe(false);
    });
});
