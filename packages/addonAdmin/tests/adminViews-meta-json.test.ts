import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

type MetaJson = {
    title: string;
    order?: number;
};

async function scanMetaJsonFiles(rootDir: string): Promise<string[]> {
    const out: string[] = [];

    if (!existsSync(rootDir)) {
        return out;
    }

    const stack: string[] = [rootDir];
    while (stack.length > 0) {
        const dir = stack.pop();
        if (!dir) {
            continue;
        }

        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === "components") {
                continue;
            }

            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }

            if (entry.isFile() && entry.name === "meta.json") {
                out.push(fullPath);
            }
        }
    }

    return out;
}

function normalizeMeta(data: any): MetaJson | null {
    if (!data || typeof data !== "object") {
        return null;
    }

    if (typeof data.title !== "string" || !data.title) {
        return null;
    }

    const order = typeof data.order === "number" && Number.isFinite(data.order) && Number.isInteger(data.order) && data.order >= 0 ? data.order : undefined;
    if (data.order !== undefined && order === undefined) {
        return null;
    }

    return {
        title: data.title,
        order: order
    };
}

describe("addonAdmin - adminViews meta.json", () => {
    test("all meta.json should exist and be valid", async () => {
        const adminViewsDir = join(process.cwd(), "packages", "addonAdmin", "adminViews");
        expect(existsSync(adminViewsDir)).toBe(true);

        const files = await scanMetaJsonFiles(adminViewsDir);
        expect(files.length).toBeGreaterThan(0);

        const invalid: Array<{ file: string; reason: string }> = [];

        for (const file of files) {
            try {
                const dir = join(file, "..");
                const indexVuePath = join(dir, "index.vue");
                if (!existsSync(indexVuePath)) {
                    invalid.push({ file: file, reason: "missing index.vue" });
                    continue;
                }

                const content = await readFile(file, "utf-8");
                const json = JSON.parse(content);
                const meta = normalizeMeta(json);
                if (!meta) {
                    invalid.push({ file: file, reason: "invalid meta shape" });
                }
            } catch {
                invalid.push({ file: file, reason: "parse failed" });
            }
        }

        expect(invalid).toEqual([]);
    });
});
