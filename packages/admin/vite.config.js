import { fileURLToPath } from "node:url";

import { createBeflyViteConfig, scanViews } from "befly-vite";

export default createBeflyViteConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    scanViews: scanViews,
    optimizeDeps: {
        include: []
    }
});
