/**
 * Befly 默认入口文件
 * 当用户项目没有自定义 main.ts 时使用此文件
 */

import { Befly } from 'befly';

const app = new Befly();
await app.listen();
