/**
 * Befly 应用启动入口
 * 环境变量由 Bun 根据 NODE_ENV 自动加载对应的 .env 文件
 * - development: .env.development
 * - production: .env.production
 * - test: .env.test
 */

import { Befly } from 'befly';

const app = new Befly();
await app.listen();
