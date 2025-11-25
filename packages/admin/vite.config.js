import { createBeflyViteConfig } from 'befly-vite';
import { scanViews } from 'befly-util/scanViews';
import { fileURLToPath } from 'node:url';

export default createBeflyViteConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    scanViews: scanViews,
    optimizeDeps: {
        include: ['befly-util']
    }
});
