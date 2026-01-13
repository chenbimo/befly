import { test, expect } from "bun:test";

import { join } from "pathe";

import { scanFiles } from "../utils/scanFiles.ts";

test("scanFiles 扫描 core：moduleName=文件名；core 不支持 api", async () => {
    const hooksDir = join(import.meta.dir, "fixtures/scanFilesCore/hooks");
    const hooks = await scanFiles(hooksDir, "core", "hook", "*.ts");
    expect(Array.isArray(hooks)).toBe(true);
    expect(hooks.length).toBe(1);

    expect(hooks[0].source).toBe("core");
    expect(hooks[0].addonName).toBe("");
    expect(hooks[0].fileName).toBe("auth");
    expect(hooks[0].moduleName).toBe("auth");
});
