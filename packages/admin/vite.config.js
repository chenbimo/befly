import { createBeflyViteConfig } from 'befly-vite';
import { scanBeflyViews } from 'befly-util';
import { fileURLToPath } from 'node:url';

export default createBeflyViteConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    scanViews: scanBeflyViews,
    optimizeDeps: {
        include: ['befly-util']
    }
});
