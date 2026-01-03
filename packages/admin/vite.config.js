import { fileURLToPath } from "node:url";

import { createBeflyViteConfig } from "befly-vite";

export default createBeflyViteConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    addonView: "adminViews",
    optimizeDeps: {
        include: []
    }
});
