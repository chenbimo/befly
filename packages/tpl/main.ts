import { Befly } from "befly/all";

const app = new Befly();

app.start().catch((err) => {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    process.stderr.write(`[befly] start failed: ${msg}\n`);
    process.exit(1);
});
