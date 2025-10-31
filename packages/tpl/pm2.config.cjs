/**
 * PM2 进程管理配置文件（CommonJS 格式）
 * 使用 Bun 运行 TypeScript 文件
 *
 * 使用方法：
 * 1. 启动：pm2 start pm2.config.cjs
 * 2. 查看状态：pm2 status
 * 3. 查看日志：pm2 logs befly
 * 4. 重启：pm2 restart befly
 * 5. 停止：pm2 stop befly
 * 6. 删除：pm2 delete befly
 * 7. 保存配置：pm2 save
 * 8. 开机自启：pm2 startup
 *
 * 环境变量加载：
 * - 默认使用生产环境：--env-file=.env.production
 *
 * 注意：PM2 配置文件必须使用 CommonJS 格式（.cjs），不支持 ESM
 */

module.exports = {
    apps: [
        {
            name: 'befly',
            script: 'main.ts',
            interpreter: 'bun',
            args: ['--env-file=.env.production'],
            // 集群模式配置
            instances: 2, // 实例数量，可设置为 'max' 使用所有 CPU
            exec_mode: 'cluster', // 集群模式

            // 自动重启配置
            autorestart: true,
            watch: false,
            ignore_watch: ['logs', 'node_modules', '*.log'],
            max_memory_restart: '500M', // 内存超过 200M 自动重启

            // 日志配置
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};
