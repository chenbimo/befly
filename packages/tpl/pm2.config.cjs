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
            },
            // 环境变量
            env322: {
                NODE_ENV: 'production',
                DEBUG: '1',
                APP_NAME: '易接口',
                APP_PORT: '3000',
                APP_HOST: '127.0.0.1',
                DEV_EMAIL: 'dev@qq.com',
                DEV_PASSWORD: '111111',
                BODY_LIMIT: '10',
                PARAMS_CHECK: '0',
                DEMO_ENABLE: 'true',
                DEMO_DEFAULT_PRIORITY: 'medium',
                DEMO_PAGE_SIZE: '10',
                DEMO_MAX_PAGE_SIZE: '100',
                LOG_EXCLUDE_FIELDS: 'password,token',
                LOG_DEBUG: '1',
                LOG_DIR: './logs',
                LOG_TO_CONSOLE: '1',
                LOG_MAX_SIZE: '52428800',
                TZ: 'Asia/Shanghai',
                CORS_ALLOWED_ORIGIN: '*',
                CORS_ALLOWED_METHODS: 'GET, POST, PUT, DELETE, OPTIONS',
                CORS_ALLOWED_HEADERS: 'Content-Type, Authorization, authorization, token',
                CORS_EXPOSE_HEADERS: 'Content-Range, X-Content-Range, Authorization, authorization, token',
                CORS_MAX_AGE: '86400',
                CORS_ALLOW_CREDENTIALS: 'true',
                DB_ENABLE: '1',
                DB_TYPE: 'mysql',
                DB_HOST: '127.0.0.1',
                DB_PORT: '3306',
                DB_USER: 'root2',
                DB_PASS: 'root2',
                DB_NAME: 'test4',
                DB_POOL_MAX: '10',
                DB_DEBUG: '0',
                DB_CONNECTION_TIMEOUT: '5000',
                REDIS_ENABLE: '1',
                REDIS_HOST: '127.0.0.1',
                REDIS_PORT: '6379',
                REDIS_USERNAME: '',
                REDIS_PASSWORD: '',
                REDIS_DB: '3',
                REDIS_KEY_PREFIX: 'befly',
                JWT_SECRET: 'dbfaf2c3-7ade-5042-b843-eca8814714b3',
                JWT_EXPIRES_IN: '30d',
                JWT_ALGORITHM: 'HS256',
                MAIL_HOST: 'demo.com',
                MAIL_PORT: '465',
                MAIL_POOL: '1',
                MAIL_SECURE: '1',
                MAIL_USER: 'demo@qq.com',
                MAIL_PASS: '',
                MAIL_SENDER: '易接口',
                MAIL_ADDRESS: 'demo@qq.com',
                LOCAL_DIR: '/wwwroot/static2/',
                PAY_NOTIFY_URL: ''
            }
        }
    ]
};
