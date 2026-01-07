import { Befly } from "befly";
const befly = new Befly();

befly.start(Bun.env.NODE_ENV || "development").catch((err) => {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    process.stderr.write(`[befly] 启动失败: ${msg}\n`);
    process.exit(1);
});
