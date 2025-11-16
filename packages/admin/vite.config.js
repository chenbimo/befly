import { createBeflyViteConfig } from 'befly-vite';
import { fileURLToPath } from 'node:url';
import { scanBeflyAddonViews } from '@befly-addon/admin/utils/scanBeflyAddonViews';

export default createBeflyViteConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    scanViews: scanBeflyAddonViews
});
