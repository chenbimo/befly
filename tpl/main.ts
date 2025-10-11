/**
 * Befly 项目入口文件
 */

import { Befly } from 'befly';

const app = new Befly();

await app.listen();

console.log('📖 访问 http://localhost:3000 查看接口列表');
