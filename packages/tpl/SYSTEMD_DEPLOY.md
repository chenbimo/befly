# Befly Systemd 部署指南

## 快速开始

### 1. 安装 Bun

```bash
# Linux/macOS
curl -fsSL https://bun.sh/install | bash

# 验证安装
bun --version
```

### 2. 部署项目

```bash
# 创建项目目录
sudo mkdir -p /var/www/befly
sudo chown -R www-data:www-data /var/www/befly

# 上传项目文件到服务器
# 方式1：使用 git
cd /var/www/befly
git clone <your-repo-url> .

# 方式2：使用 rsync
rsync -avz --exclude 'node_modules' ./ user@server:/var/www/befly/

# 安装依赖
cd /var/www/befly
bun install --production
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.development .env.production

# 编辑生产环境配置
nano .env.production
```

### 4. 配置 systemd 服务

```bash
# 复制 service 文件
sudo cp befly.service /etc/systemd/system/

# 编辑配置（修改路径、用户等）
sudo nano /etc/systemd/system/befly.service

# 需要修改的配置项：
# - WorkingDirectory: 项目实际路径
# - User/Group: 运行用户
# - ExecStart: bun 的实际路径（使用 which bun 查看）
```

### 5. 启动服务

```bash
# 重载 systemd 配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start befly

# 查看状态
sudo systemctl status befly

# 设置开机自启
sudo systemctl enable befly
```

## 常用命令

### 服务管理

```bash
# 启动服务
sudo systemctl start befly

# 停止服务
sudo systemctl stop befly

# 重启服务
sudo systemctl restart befly

# 重载配置（不重启服务）
sudo systemctl reload befly

# 查看服务状态
sudo systemctl status befly

# 查看服务是否开机自启
sudo systemctl is-enabled befly

# 启用开机自启
sudo systemctl enable befly

# 禁用开机自启
sudo systemctl disable befly
```

### 日志查看

```bash
# 实时查看日志
sudo journalctl -u befly -f

# 查看最近100行日志
sudo journalctl -u befly -n 100

# 查看今天的日志
sudo journalctl -u befly --since today

# 查看指定时间的日志
sudo journalctl -u befly --since "2025-01-01 00:00:00" --until "2025-01-01 23:59:59"

# 查看错误日志
sudo journalctl -u befly -p err

# 查看完整日志（包括被截断的内容）
sudo journalctl -u befly --no-pager

# 导出日志
sudo journalctl -u befly > befly.log
```

### 配置修改后重载

```bash
# 修改 service 文件后
sudo systemctl daemon-reload
sudo systemctl restart befly
```

## 配置说明

### 单进程模式

```ini
# Systemd 推荐单进程模式
ExecStart=/usr/local/bin/bun run befly start
```

**集群部署推荐使用 PM2**：Systemd 适合单进程部署，如需集群模式请使用 PM2（参见项目根目录的 PM2 相关文档）

### 用户和权限

```bash
# 创建专用用户（推荐）
sudo useradd -r -s /bin/false befly

# 设置目录权限
sudo chown -R befly:befly /var/www/befly

# 修改 service 文件
User=befly
Group=befly
```

### 资源限制调整

```ini
# 根据服务器配置调整
MemoryMax=4G              # 4个Worker进程，每个约1G
MemoryHigh=3G             # 内存高水位警告
LimitNOFILE=65536         # 高并发场景增加
CPUQuota=200%             # 限制最多使用2个CPU核心
```

### 环境变量配置

```ini
# 在 service 文件中添加
Environment="NODE_ENV=production"
Environment="APP_PORT=3000"
Environment="APP_HOST=0.0.0.0"
Environment="DATABASE_URL=postgresql://..."
Environment="REDIS_URL=redis://..."

# 或使用环境文件
EnvironmentFile=/var/www/befly/.env.production
```

## 反向代理配置

### Nginx 配置示例

#### 单进程模式

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # HTTPS 配置（推荐）
    # listen 443 ssl http2;
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 传递客户端信息
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态文件（如果有）
    location /static/ {
        root /var/www/befly/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Caddy 配置示例

```caddyfile
yourdomain.com {
    reverse_proxy localhost:3000 localhost:3001 localhost:3002 localhost:3003 {
        lb_policy least_conn
        health_uri /health
        health_interval 10s
    }
}
```

## 监控和告警

### 基础监控脚本

```bash
#!/bin/bash
# 保存为 /usr/local/bin/befly-monitor.sh

SERVICE="befly"
EMAIL="admin@example.com"

# 检查服务状态
if ! systemctl is-active --quiet $SERVICE; then
    echo "Service $SERVICE is down! Attempting restart..." | mail -s "Alert: Befly Service Down" $EMAIL
    systemctl restart $SERVICE
fi

# 检查内存使用
MEMORY=$(systemctl show $SERVICE -p MemoryCurrent --value)
MEMORY_MB=$((MEMORY / 1024 / 1024))
if [ $MEMORY_MB -gt 3500 ]; then
    echo "Service $SERVICE using ${MEMORY_MB}MB memory (high)" | mail -s "Warning: High Memory Usage" $EMAIL
fi
```

### 定时监控（crontab）

```bash
# 编辑 crontab
sudo crontab -e

# 每5分钟检查一次
*/5 * * * * /usr/local/bin/befly-monitor.sh
```

## 故障排查

### 服务启动失败

```bash
# 查看详细错误信息
sudo systemctl status befly -l

# 查看完整日志
sudo journalctl -u befly -n 100 --no-pager

# 检查配置文件语法
sudo systemd-analyze verify /etc/systemd/system/befly.service

# 测试启动命令
cd /var/www/befly
sudo -u www-data bun run befly start
```

### 权限问题

```bash
# 检查文件权限
ls -la /var/www/befly

# 修复权限
sudo chown -R www-data:www-data /var/www/befly
sudo chmod -R 755 /var/www/befly

# 检查日志目录权限
sudo mkdir -p /var/www/befly/logs
sudo chown -R www-data:www-data /var/www/befly/logs
```

### 端口占用

```bash
# 检查端口是否被占用
sudo netstat -tulpn | grep :3000

# 或使用 ss
sudo ss -tulpn | grep :3000

# 杀死占用端口的进程
sudo kill -9 <PID>
```

## 升级和维护

### 应用升级

```bash
# 拉取最新代码
cd /var/www/befly
git pull

# 安装新依赖
bun install --production

# 重启服务
sudo systemctl restart befly

# 查看状态
sudo systemctl status befly
```

### 日志清理

```bash
# 查看日志占用空间
sudo journalctl --disk-usage

# 清理旧日志（保留最近7天）
sudo journalctl --vacuum-time=7d

# 清理日志（保留最近1GB）
sudo journalctl --vacuum-size=1G

# 配置自动清理（编辑配置文件）
sudo nano /etc/systemd/journald.conf

# 添加配置
SystemMaxUse=1G
MaxRetentionSec=7day
```

## 安全建议

### 防火墙配置

```bash
# 使用 ufw
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 或使用 firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 最小权限原则

```bash
# 禁止 befly 用户登录
sudo usermod -s /bin/false befly

# 限制目录访问
sudo chmod 750 /var/www/befly
```

### 定期更新

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y  # Debian/Ubuntu
# 或
sudo yum update -y  # CentOS/RHEL

# 更新 Bun
bun upgrade
```

## 备份策略

```bash
#!/bin/bash
# 保存为 /usr/local/bin/befly-backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/befly"
PROJECT_DIR="/var/www/befly"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份配置和代码
tar -czf $BACKUP_DIR/befly_$DATE.tar.gz \
    $PROJECT_DIR/.env.production \
    $PROJECT_DIR/package.json \
    $PROJECT_DIR/bun.lockb \
    /etc/systemd/system/befly.service

# 保留最近30天的备份
find $BACKUP_DIR -name "befly_*.tar.gz" -mtime +30 -delete
```

## 性能优化

### Bun 优化

```bash
# 使用生产模式
NODE_ENV=production

# 禁用调试日志
DEBUG=0
```

### 系统优化

```bash
# 增加文件描述符限制
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# 优化内核参数
sudo sysctl -w net.core.somaxconn=65535
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=8192
```

## 联系和支持

- 文档：https://github.com/chenbimo/befly
- 问题反馈：GitHub Issues
