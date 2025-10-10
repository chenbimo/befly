/**
 * Befly 3.0 - TypeScript 示例项目入口
 *
 * 这是一个完整的 TypeScript 项目示例，展示如何使用 Befly 3.0 的所有特性
 */

import { Server } from 'befly';

// 启动服务器
await Server({
    name: 'Befly TypeScript Demo',
    port: 3000
});

console.log('🚀 Befly TypeScript 示例服务已启动！');
console.log('📖 访问 http://localhost:3000 查看接口列表');
