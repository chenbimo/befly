/**
 * Befly 框架主入口文件
 * 提供简洁的框架接口，核心逻辑已提取到 lifecycle 层
 */

import { Env } from './config/env.js';
import { Fields } from './config/fields.js';
import { Api } from './utils/framework.js';
import { Yes, No } from './utils/index.js';
import { Logger } from './utils/logger.js';
import { Jwt } from './utils/jwt.js';
import { Validator } from './utils/validate.js';
import { Crypto2 } from './utils/crypto.js';
import { SqlHelper } from './utils/sqlHelper.js';
import { createSqlClient } from './utils/dbHelper.js';
import { RedisHelper } from './utils/redisHelper.js';
import { Lifecycle } from './lifecycle/lifecycle.js';

import type { Server } from 'bun';
import type { BeflyContext, BeflyOptions } from './types/befly.js';

/**
 * Befly 框架核心类
 * 职责：管理应用上下文和生命周期
 */
export class Befly {
    /** 生命周期管理器 */
    private lifecycle: Lifecycle;

    /** 应用上下文 */
    public appContext: BeflyContext;

    constructor(options: BeflyOptions = {}) {
        this.lifecycle = new Lifecycle(options);
        this.appContext = {};
    }

    /**
     * 启动服务器
     * @param callback - 启动完成后的回调函数
     */
    async listen(callback?: (server: Server) => void): Promise<void> {
        await this.lifecycle.start(this.appContext, callback);
    }
}

// 核心类和工具导出（只导出运行时代码，不导出类型）
export { Env, Fields, Api, Jwt, Validator, Crypto2, Logger, Yes, No, SqlHelper, createSqlClient, RedisHelper };
