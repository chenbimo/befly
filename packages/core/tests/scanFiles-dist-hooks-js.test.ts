import { test, expect } from "bun:test";

import { scanFiles } from "../utils/scanFiles.ts";

test("scanFiles 扫描 core：moduleName=文件名；core 不支持 api", async () => {
    const hooks = await scanFiles("./packages/core/tests/fixtures/scanFilesCore/hooks", "core" as any, "hook", "*.ts");
    expect(Array.isArray(hooks)).toBe(true);
    expect(hooks.length).toBe(1);

    expect(hooks[0].source).toBe("core");
    expect(hooks[0].addonName).toBe("");
    expect(hooks[0].fileName).toBe("auth");
    expect(hooks[0].moduleName).toBe("auth");
});
