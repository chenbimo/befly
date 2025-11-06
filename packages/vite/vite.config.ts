import { defineConfig } from 'vite';
import { plugins, viteResolve, define, css, server, logLevel, build, optimizeDeps } from './config';

export default defineConfig({
    root: process.cwd(),
    baseDir: './',
    plugins,
    resolve: viteResolve,
    define,
    css,
    server,
    logLevel,
    optimizeDeps,
    build
});
