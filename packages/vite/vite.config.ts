import { defineConfig } from 'vite';
import { plugins, viteResolve, define, css, server, logLevel, build, optimizeDeps } from './config';

export default defineConfig({
    plugins,
    resolve: viteResolve,
    define,
    css,
    server,
    logLevel,
    optimizeDeps,
    build
});
