module.exports = {
  apps: [
    {
      name: "befly",
      script: "main.ts",
      interpreter: "bun",

      // 集群模式配置
      instances: 2, // 实例数量，可设置为 'max' 使用所有 CPU
      exec_mode: "cluster", // 集群模式

      // 自动重启配置
      autorestart: true,
      watch: false,
      max_memory_restart: "500M", // 内存超过 500M 自动重启

      // 日志配置
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // 从 .env.production 动态加载的环境变量（使用 Bun API）
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
