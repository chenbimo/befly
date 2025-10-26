/**
 * Spinner 工具 - 加载动画
 */

import ora from 'ora';

export class Spinner {
    static start(text: string) {
        return ora({
            text,
            color: 'cyan',
            spinner: 'dots'
        }).start();
    }
}
