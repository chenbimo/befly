import { createBeflyViteConfig, scanBeflyAddonViews } from 'befly-vite';
import { fileURLToPath } from 'node:url';

export default createBeflyViteConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    scanViews: scanBeflyAddonViews,
    optimizeDeps: {
        include: ['befly-util']
    }
});
