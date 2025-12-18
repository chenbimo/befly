import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { scanConfig } from "../utils/scanConfig";

const tempRootDir = join(process.cwd(), "temp", "test-scan-config");

function writeJson(filePath: string, data: Record<string, any>) {
    const json = JSON.stringify(data, null, 4);
    writeFileSync(filePath, json, { encoding: "utf8" });
}

function createCaseDirs(): { caseRootDir: string; dirA: string; dirB: string } {
    const caseRootDir = join(tempRootDir, `case-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const dirA = join(caseRootDir, "a");
    const dirB = join(caseRootDir, "b");

    if (!existsSync(dirA)) {
        mkdirSync(dirA, { recursive: true });
    }
    if (!existsSync(dirB)) {
        mkdirSync(dirB, { recursive: true });
    }

    return {
        caseRootDir: caseRootDir,
        dirA: dirA,
        dirB: dirB
    };
}

afterAll(() => {
    if (existsSync(tempRootDir)) {
        rmSync(tempRootDir, { recursive: true, force: true });
    }
});

describe("utils - scanConfig", () => {
    beforeAll(() => {
        if (!existsSync(tempRootDir)) {
            mkdirSync(tempRootDir, { recursive: true });
        }
    });

    beforeEach(() => {
        // 无需清空：每个用例使用唯一目录，避免 import cache 干扰
    });

    test("mode=first：返回搜索到的第一个配置（按 dirs 顺序）", async () => {
        const { caseRootDir, dirA, dirB } = createCaseDirs();

        writeJson(join(dirA, "cfg.json"), {
            foo: 1,
            database: { host: "a" }
        });
        writeJson(join(dirB, "cfg.json"), {
            foo: 2,
            database: { host: "b" }
        });

        const config = await scanConfig({
            cwd: caseRootDir,
            dirs: ["a", "b"],
            files: ["cfg"],
            extensions: [".json"],
            mode: "first"
        });

        expect(config).toEqual({
            foo: 1,
            database: { host: "a" }
        });
    });

    test("mode=merge：按 defaults ← a ← b 合并（数组拼接，标量后者覆盖）", async () => {
        const { caseRootDir, dirA, dirB } = createCaseDirs();

        writeJson(join(dirA, "cfg.json"), {
            foo: 1,
            menus: ["a"],
            database: { host: "a", port: 3306 },
            nested: { a: 1 }
        });
        writeJson(join(dirB, "cfg.json"), {
            foo: 2,
            menus: ["b"],
            database: { host: "b" },
            nested: { b: 2 }
        });

        const config = await scanConfig({
            cwd: caseRootDir,
            dirs: ["a", "b"],
            files: ["cfg"],
            extensions: [".json"],
            mode: "merge",
            defaults: {
                foo: 0,
                menus: ["default"],
                database: { host: "default", port: 1111 },
                nested: { z: 9 }
            }
        });

        // merge-anything 的 mergeAndConcat：数组拼接；对象深合并；标量后者覆盖
        expect(config.foo).toBe(2);
        expect(config.menus).toEqual(["default", "a", "b"]);
        expect(config.database).toEqual({
            host: "b",
            port: 3306
        });
        expect(config.nested).toEqual({
            z: 9,
            a: 1,
            b: 2
        });
    });

    test("paths：只返回指定路径字段", async () => {
        const { caseRootDir, dirA } = createCaseDirs();

        writeJson(join(dirA, "cfg.json"), {
            foo: 1,
            menus: ["a"],
            database: { host: "a", port: 3306 },
            secret: "should-not-return"
        });

        const config = await scanConfig({
            cwd: caseRootDir,
            dirs: ["a"],
            files: ["cfg"],
            extensions: [".json"],
            mode: "first",
            paths: ["menus", "database.host", "not.exists"]
        });

        expect(config).toEqual({
            menus: ["a"],
            database: { host: "a" }
        });
    });
});
