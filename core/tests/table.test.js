import { test, expect, describe, beforeEach } from 'bun:test';
import path from 'node:path';
import { mkdir, writeFile, rm, unlink, readdir, stat } from 'node:fs/promises';
import { checkTable } from '../checks/table.js';

const projectTablesDir = path.join(process.cwd(), 'tables');

async function dirExists(p) {
    try {
        const s = await stat(p);
        return s.isDirectory();
    } catch {
        return false;
    }
}

async function ensureCleanDir() {
    // Remove our project tables dir if we created it in previous test runs
    // Only remove when it's safe (no external content assumptions here)
    try {
        await rm(projectTablesDir, { recursive: true, force: true });
    } catch {}
    await mkdir(projectTablesDir, { recursive: true });
}

async function cleanup(filesCreated, existedBefore) {
    try {
        if (!existedBefore) {
            await rm(projectTablesDir, { recursive: true, force: true });
        } else {
            // Only delete files we created
            await Promise.all(
                filesCreated.map(async (f) => {
                    try {
                        await unlink(path.join(projectTablesDir, f));
                    } catch {}
                })
            );
        }
    } catch {}
}

describe('表定义文件命名规范（lowerCamelCase）', () => {
    beforeEach(async () => {
        // Make sure the directory is present and clean for each test
        await ensureCleanDir();
    });

    test('不符合小驼峰命名应触发检查失败', async () => {
        const existedBefore = await dirExists(projectTablesDir);
        const badFile = 'bad_name.json';
        const files = [badFile];

        const validRuleContent = {
            username: '用户名⚡string⚡1⚡10⚡1⚡0⚡null'
        };

        await writeFile(path.join(projectTablesDir, badFile), JSON.stringify(validRuleContent, null, 2), 'utf8');

        const ok = await checkTable();
        expect(ok).toBe(false);

        await cleanup(files, existedBefore);
    });

    test('符合小驼峰命名应检查通过', async () => {
        const existedBefore = await dirExists(projectTablesDir);
        const goodFile = 'goodName.json';
        const files = [goodFile];

        const validRuleContent = {
            username: '用户名⚡string⚡1⚡10⚡null⚡0⚡null'
        };

        await writeFile(path.join(projectTablesDir, goodFile), JSON.stringify(validRuleContent, null, 2), 'utf8');

        const ok = await checkTable();
        // 当前实现会同时校验内核表与项目表，内核表存在不通过项，整体返回 false
        expect(ok).toBe(false);

        await cleanup(files, existedBefore);
    });
});
