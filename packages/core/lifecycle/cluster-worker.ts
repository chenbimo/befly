/**
 * Cluster Worker 入口
 * 由 ClusterManager 启动的子进程入口文件
 */

import { Befly } from '../main.js';

// 启动 Befly 实例
const app = new Befly();
await app.listen();
