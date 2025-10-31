import { Env } from '../core/env.js';

console.log('当前环境:', Env.NODE_ENV);
console.log('项目名称:', Env.APP_NAME);
console.log('数据库名称:', Env.DB_NAME);
console.log('数据库密码:', Env.DB_PASS ? '***' : '(空)');
