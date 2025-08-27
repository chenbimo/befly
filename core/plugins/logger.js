import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';

export default {
    after: [],
    async onInit(befly) {
        try {
            return Logger;
        } catch (error) {
            // 插件内禁止直接退出进程，抛出异常交由主流程统一处理
            throw error;
        }
    }
};
