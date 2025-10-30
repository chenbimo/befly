/**
 * PM2 进程管理配置文件
 *
 * 使用方法：
 * 1. 启动生产环境：pm2 start ecosystem.config.js --env production
 * 2. 启动开发环境：pm2 start ecosystem.config.js --env development
 * 3. 查看状态：pm2 status
 * 4. 查看日志：pm2 logs befly
 * 5. 重启：pm2 restart befly
 * 6. 停止：pm2 stop befly
 * 7. 删除：pm2 delete befly
 * 8. 保存配置：pm2 save
 * 9. 开机自启：pm2 startup
 */

module.exports = {
    apps: [
        {
            name: 'befly',
            script: './main.ts',
            interpreter: 'bun',

            // 集群模式配置
            instances: 4, // 实例数量，可设置为 'max' 使用所有 CPU
            exec_mode: 'cluster', // 集群模式

            // 自动重启配置
            autorestart: true,
            watch: false, // 生产环境不监听文件变化
            max_memory_restart: '1G', // 内存超过 1G 自动重启

            // 日志配置
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,

            // 生产环境变量
            env_production: {
                NODE_ENV: 'production',
                APP_PORT: 3000,
                APP_HOST: '0.0.0.0'
            },

            // 开发环境变量
            env_development: {
                NODE_ENV: 'development',
                APP_PORT: 3000,
                APP_HOST: '0.0.0.0'
            }
        }
    ]
};
