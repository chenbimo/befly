import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts', 'src/fieldClear.ts', 'src/arrayToTree.ts'],
    format: ['esm'],
    dts: true,
    clean: true
});
