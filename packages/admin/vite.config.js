import { createBeflyViteConfig, scanBeflyViews } from 'befly-vite';
import { fileURLToPath } from 'node:url';

export default createBeflyViteConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    scanViews: scanBeflyViews,
    optimizeDeps: {
        include: ['befly-util']
    }
});
