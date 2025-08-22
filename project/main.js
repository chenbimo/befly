import { Befly, Logger } from '../main.js';

// 配置服务器
const app = new Befly({
    routes: {}
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('正在优雅关闭...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('正在优雅关闭...');
    process.exit(0);
});

// 启动服务器
app.listen((server) => {
    console.log(`服务器已启动: http://${server.hostname}:${server.port}`);
});
