/**
 * Vite 开发服务器配置
 */
import type { LogLevel, LogErrorOptions } from 'vite';

export const server = {
    port: 5173,
    host: true,
    open: false
};

export const logLevel: LogLevel = 'info';

export const customLogger = {
    info: (msg: string) => {
        if (msg.includes('new dependencies optimized')) {
            return;
        }
        console.info(msg);
    },
    warn: (msg: string) => {
        console.warn(msg);
    },
    error: (msg: string, options?: LogErrorOptions) => {
        console.error(msg);
    },
    warnOnce: (msg: string) => {
        console.warn(msg);
    },
    clearScreen: () => {},
    hasErrorLogged: () => false,
    hasWarned: false
};
