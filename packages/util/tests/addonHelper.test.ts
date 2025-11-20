import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { join, resolve } from 'pathe';
import { mkdirSync, rmdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { scanAddons, getAddonDir, addonDirExists } from '../src/addonHelper';

// Use absolute path to workspace root temp dir
const WORKSPACE_ROOT = resolve(__dirname, '../../..');
const TEST_DIR = join(WORKSPACE_ROOT, 'temp', 'test-addons-util');
const NODE_MODULES_DIR = join(TEST_DIR, 'node_modules');
const BEFLY_ADDON_DIR = join(NODE_MODULES_DIR, '@befly-addon');
// const LOCAL_ADDONS_DIR = join(TEST_DIR, 'addons');

describe('addonHelper', () => {
    beforeAll(() => {
        // Setup test directories
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true, force: true });
        }
        mkdirSync(TEST_DIR, { recursive: true });
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
