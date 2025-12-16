import { fileURLToPath } from "node:url";

import { createBeflyViteConfig } from "befly-vite";
import { scanViews } from "befly-vite/utils/scanViews";

export default createBeflyViteConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  scanViews: scanViews,
  optimizeDeps: {
    include: [],
  },
});
