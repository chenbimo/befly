<template>
    <div class="dashboard-container">
        <!-- 顶部欢迎区 -->
        <div class="welcome-section">
            <div class="welcome-content">
                <h1 class="welcome-title">欢迎使用 Befly Admin</h1>
                <p class="welcome-desc">强大、灵活、易用的后台管理系统</p>
            </div>
            <div class="welcome-status">
                <div class="status-badge status-online">
                    <Icon name="Activity" :size="16" />
                    <span>系统运行正常</span>
                </div>
            </div>
        </div>

        <!-- 第一行：系统信息和权限统计 -->
        <div class="section-block">
            <div class="section-header">
                <Icon name="Info" :size="20" />
                <h2>系统概览</h2>
            </div>
            <div class="section-content">
                <t-row :gutter="16">
                    <t-col :xs="24" :sm="12" :md="12" :lg="12">
                        <div class="info-block">
                            <div class="info-header">
                                <Icon name="Server" :size="18" />
                                <span class="info-title">系统信息</span>
                            </div>
                            <div class="info-list">
                                <div class="info-item">
                                    <span class="label">系统名称</span>
                                    <span class="value">{{ $Data.systemInfo.systemName }}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">当前版本</span>
                                    <span class="value">
                                        <t-tag theme="primary" variant="outline" size="small">{{ $Data.systemInfo.version }}</t-tag>
                                    </span>
                                </div>
                                <div class="info-item">
                                    <span class="label">运行环境</span>
                                    <span class="value">
                                        <t-tag theme="success" variant="outline" size="small">{{ $Data.systemInfo.environment }}</t-tag>
                                    </span>
                                </div>
                                <div class="info-item">
                                    <span class="label">运行时长</span>
                                    <span class="value highlight">{{ $Method.formatUptime($Data.systemInfo.uptime) }}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">启动时间</span>
                                    <span class="value">{{ $Method.formatDateTime($Data.systemInfo.startTime) }}</span>
                                </div>
                            </div>
                        </div>
                    </t-col>
                    <t-col :xs="24" :sm="12" :md="12" :lg="12">
                        <div class="info-block">
                            <div class="info-header">
                                <Icon name="Shield" :size="18" />
                                <span class="info-title">权限统计</span>
                            </div>
                            <div class="stats-grid">
                                <div class="stat-box stat-primary">
                                    <Icon name="Menu" :size="24" />
                                    <div class="stat-content">
                                        <div class="stat-value">{{ $Data.permissionStats.menuCount }}</div>
                                        <div class="stat-label">菜单总数</div>
                                    </div>
                                </div>
                                <div class="stat-box stat-success">
                                    <Icon name="Webhook" :size="24" />
                                    <div class="stat-content">
                                        <div class="stat-value">{{ $Data.permissionStats.apiCount }}</div>
                                        <div class="stat-label">接口总数</div>
                                    </div>
                                </div>
                                <div class="stat-box stat-warning">
                                    <Icon name="Users" :size="24" />
                                    <div class="stat-content">
                                        <div class="stat-value">{{ $Data.permissionStats.roleCount }}</div>
                                        <div class="stat-label">角色总数</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </t-col>
                </t-row>
            </div>
        </div>

        <!-- 第二行：配置状态 -->
        <div class="section-block">
            <div class="section-header">
                <Icon name="Settings" :size="20" />
                <h2>服务状态</h2>
            </div>
            <div class="section-content">
                <div class="config-grid">
                    <div v-for="(item, key) in $Data.configStatus" :key="key" class="config-card" :class="`config-${item.status}`">
                        <div class="config-icon">
                            <Icon :name="$Method.getConfigIcon(key)" :size="28" />
                        </div>
                        <div class="config-info">
                            <div class="config-name">{{ $Method.getConfigLabel(key) }}</div>
                            <div class="config-status">
                                <Icon :name="$Method.getStatusIcon(item.status)" :size="14" />
                                <span>{{ item.message }}</span>
                                <span v-if="item.latency" class="latency">{{ item.latency }}ms</span>
                            </div>
                        </div>
                        <div class="config-badge">
                            <Icon :name="$Method.getStatusIcon(item.status)" :size="20" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 已安装插件 -->
        <div class="section-block">
            <div class="section-header">
                <Icon name="Package" :size="20" />
                <h2>已安装插件</h2>
                <t-tag theme="primary" variant="outline" size="small">{{ $Data.addonList.length }}</t-tag>
            </div>
            <div class="section-content">
                <div class="addon-list">
                    <div v-for="addon in $Data.addonList" :key="addon.name" class="addon-item">
                        <div class="addon-icon">
                            <Icon name="Box" :size="24" />
                        </div>
                        <div class="addon-info">
                            <div class="addon-title">
                                <span class="addon-name">{{ addon.title }}</span>
                                <t-tag theme="success" variant="outline" size="small">{{ addon.version }}</t-tag>
                            </div>
                            <div class="addon-desc">{{ addon.description }}</div>
                        </div>
                        <div class="addon-status">
                            <t-tag v-if="addon.enabled" theme="success" size="small">已启用</t-tag>
                            <t-tag v-else theme="default" size="small">已禁用</t-tag>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 系统资源监控 -->
        <div class="section-block">
            <div class="section-header">
                <Icon name="Activity" :size="20" />
                <h2>系统资源</h2>
            </div>
            <div class="section-content">
                <t-row :gutter="16">
                    <t-col :xs="24" :sm="12" :md="8" :lg="8">
                        <div class="resource-card">
                            <div class="resource-header">
                                <Icon name="Cpu" :size="20" />
                                <span>CPU使用率</span>
                            </div>
                            <div class="resource-value">{{ $Data.systemResources.cpu.usage }}%</div>
                            <t-progress :percentage="$Data.systemResources.cpu.usage" :theme="$Method.getProgressColor($Data.systemResources.cpu.usage)" />
                            <div class="resource-info">{{ $Data.systemResources.cpu.cores }} 核心</div>
                        </div>
                    </t-col>
                    <t-col :xs="24" :sm="12" :md="8" :lg="8">
                        <div class="resource-card">
                            <div class="resource-header">
                                <Icon name="HardDrive" :size="20" />
                                <span>内存使用率</span>
                            </div>
                            <div class="resource-value">{{ $Data.systemResources.memory.percentage }}%</div>
                            <t-progress :percentage="$Data.systemResources.memory.percentage" :theme="$Method.getProgressColor($Data.systemResources.memory.percentage)" />
                            <div class="resource-info">{{ $Data.systemResources.memory.used }}GB / {{ $Data.systemResources.memory.total }}GB</div>
                        </div>
                    </t-col>
                    <t-col :xs="24" :sm="12" :md="8" :lg="8">
                        <div class="resource-card">
                            <div class="resource-header">
                                <Icon name="Disc" :size="20" />
                                <span>磁盘使用率</span>
                            </div>
                            <div class="resource-value">{{ $Data.systemResources.disk.percentage }}%</div>
                            <t-progress :percentage="$Data.systemResources.disk.percentage" :theme="$Method.getProgressColor($Data.systemResources.disk.percentage)" />
                            <div class="resource-info">{{ $Data.systemResources.disk.used }}GB / {{ $Data.systemResources.disk.total }}GB</div>
                        </div>
                    </t-col>
                </t-row>
            </div>
        </div>

        <!-- 数据库统计和性能指标 -->
        <t-row :gutter="16" class="content-row">
            <t-col :xs="24" :sm="24" :md="12" :lg="12">
                <div class="section-block">
                    <div class="section-header">
                        <Icon name="Database" :size="20" />
                        <h2>数据库统计</h2>
                    </div>
                    <div class="section-content">
                        <div class="database-grid">
                            <div class="database-item">
                                <div class="db-icon">
                                    <Icon name="Table" :size="24" />
                                </div>
                                <div class="db-info">
                                    <div class="db-value">{{ $Data.databaseStats.tableCount }}</div>
                                    <div class="db-label">数据表</div>
                                </div>
                            </div>
                            <div class="database-item">
                                <div class="db-icon">
                                    <Icon name="FileText" :size="24" />
                                </div>
                                <div class="db-info">
                                    <div class="db-value">{{ $Data.databaseStats.totalRows }}</div>
                                    <div class="db-label">数据行数</div>
                                </div>
                            </div>
                            <div class="database-item">
                                <div class="db-icon">
                                    <Icon name="HardDrive" :size="24" />
                                </div>
                                <div class="db-info">
                                    <div class="db-value">{{ $Data.databaseStats.databaseSize }}</div>
                                    <div class="db-label">数据库大小</div>
                                </div>
                            </div>
                            <div class="database-item">
                                <div class="db-icon">
                                    <Icon name="Link" :size="24" />
                                </div>
                                <div class="db-info">
                                    <div class="db-value">{{ $Data.databaseStats.connections.current }}/{{ $Data.databaseStats.connections.max }}</div>
                                    <div class="db-label">连接数</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </t-col>

            <t-col :xs="24" :sm="24" :md="12" :lg="12">
                <div class="section-block">
                    <div class="section-header">
                        <Icon name="Zap" :size="20" />
                        <h2>性能指标</h2>
                    </div>
                    <div class="section-content">
                        <div class="performance-list">
                            <div class="perf-item">
                                <span class="perf-label">平均响应时间</span>
                                <span class="perf-value">{{ $Data.performance.avgResponseTime }}ms</span>
                            </div>
                            <div class="perf-item">
                                <span class="perf-label">最慢接口</span>
                                <span class="perf-value">{{ $Data.performance.slowestApi.name }} ({{ $Data.performance.slowestApi.time }}ms)</span>
                            </div>
                            <div class="perf-item">
                                <span class="perf-label">今日请求总数</span>
                                <span class="perf-value highlight">{{ $Data.performance.totalRequests }}</span>
                            </div>
                            <div class="perf-item">
                                <span class="perf-label">成功率</span>
                                <span class="perf-value success">{{ $Data.performance.successRate }}%</span>
                            </div>
                            <div class="perf-item">
                                <span class="perf-label">缓存命中率</span>
                                <span class="perf-value success">{{ $Data.performance.cacheHitRate }}%</span>
                            </div>
                            <div class="perf-item">
                                <span class="perf-label">错误率</span>
                                <span class="perf-value" :class="$Data.performance.errorRate > 1 ? 'error' : 'success'">{{ $Data.performance.errorRate }}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </t-col>
        </t-row>

        <!-- 运行环境 -->
        <div class="section-block">
            <div class="section-header">
                <Icon name="Monitor" :size="20" />
                <h2>运行环境</h2>
            </div>
            <div class="section-content">
                <div class="env-grid">
                    <div class="env-item">
                        <Icon name="Box" :size="18" />
                        <div class="env-info">
                            <div class="env-label">Node.js</div>
                            <div class="env-value">{{ $Data.environmentInfo.nodeVersion }}</div>
                        </div>
                    </div>
                    <div class="env-item">
                        <Icon name="Zap" :size="18" />
                        <div class="env-info">
                            <div class="env-label">Bun</div>
                            <div class="env-value">{{ $Data.environmentInfo.bunVersion }}</div>
                        </div>
                    </div>
                    <div class="env-item">
                        <Icon name="Database" :size="18" />
                        <div class="env-info">
                            <div class="env-label">MySQL</div>
                            <div class="env-value">{{ $Data.environmentInfo.mysqlVersion }}</div>
                        </div>
                    </div>
                    <div class="env-item">
                        <Icon name="Layers" :size="18" />
                        <div class="env-info">
                            <div class="env-label">Redis</div>
                            <div class="env-value">{{ $Data.environmentInfo.redisVersion }}</div>
                        </div>
                    </div>
                    <div class="env-item">
                        <Icon name="Server" :size="18" />
                        <div class="env-info">
                            <div class="env-label">操作系统</div>
                            <div class="env-value">{{ $Data.environmentInfo.os }}</div>
                        </div>
                    </div>
                    <div class="env-item">
                        <Icon name="Laptop" :size="18" />
                        <div class="env-info">
                            <div class="env-label">平台</div>
                            <div class="env-value">{{ $Data.environmentInfo.platform }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 快捷操作 -->
        <div class="section-block">
            <div class="section-header">
                <Icon name="Zap" :size="20" />
                <h2>快捷操作</h2>
            </div>
            <div class="section-content">
                <div class="quick-actions-grid">
                    <t-button v-for="action in $Data.quickActions" :key="action.action" :theme="action.theme" @click="$Method.handleQuickAction(action.action)">
                        <template #icon>
                            <Icon :name="action.icon" :size="16" />
                        </template>
                        {{ action.label }}
                    </t-button>
                </div>
            </div>
        </div>

        <!-- 操作日志和通知待办 -->
        <t-row :gutter="16" class="content-row">
            <t-col :xs="24" :sm="24" :md="14" :lg="14">
                <div class="section-block">
                    <div class="section-header">
                        <Icon name="FileText" :size="20" />
                        <h2>最近操作</h2>
                        <t-tag theme="primary" variant="outline" size="small">最近{{ $Data.operationLogs.length }}条</t-tag>
                    </div>
                    <div class="section-content">
                        <div class="operation-list">
                            <div v-for="(log, index) in $Data.operationLogs" :key="index" class="operation-item">
                                <div class="operation-icon">
                                    <Icon :name="$Method.getLogStatusIcon(log.status)" :size="16" :color="$Method.getLogStatusColor(log.status)" />
                                </div>
                                <div class="operation-content">
                                    <div class="operation-main">
                                        <span class="operation-user">{{ log.user }}</span>
                                        <span class="operation-action">{{ log.action }}</span>
                                        <span class="operation-target">{{ log.target }}</span>
                                    </div>
                                    <div class="operation-time">{{ log.time }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </t-col>

            <t-col :xs="24" :sm="24" :md="10" :lg="10">
                <div class="section-block">
                    <div class="section-header">
                        <Icon name="Bell" :size="20" />
                        <h2>通知与待办</h2>
                    </div>
                    <div class="section-content">
                        <div class="notification-section">
                            <h3 class="subsection-title">系统通知</h3>
                            <div class="notification-list">
                                <div v-for="(notif, index) in $Data.notifications" :key="index" class="notification-item" :class="`notif-${notif.type}`">
                                    <Icon :name="$Method.getNotificationIcon(notif.type)" :size="16" />
                                    <div class="notification-content">
                                        <div class="notification-title">{{ notif.title }}</div>
                                        <div class="notification-desc">{{ notif.content }}</div>
                                        <div class="notification-time">{{ notif.time }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="todo-section">
                            <h3 class="subsection-title">待办事项</h3>
                            <div class="todo-list">
                                <div v-for="todo in $Data.todoItems" :key="todo.title" class="todo-item">
                                    <div class="todo-info">
                                        <span class="todo-title">{{ todo.title }}</span>
                                        <t-tag theme="warning" size="small">{{ todo.count }}</t-tag>
                                    </div>
                                    <Icon name="ChevronRight" :size="16" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </t-col>
        </t-row>
    </div>
</template>

<script setup>
// 响应式数据（使用假数据）
const $Data = $ref({
    loading: false,
    systemInfo: {
        systemName: 'Befly Admin',
        version: 'v1.0.0',
        environment: 'Production',
        startTime: Date.now() - 56520000, // 15小时32分钟前
        uptime: 56520000
    },
    permissionStats: {
        menuCount: 23,
        apiCount: 156,
        roleCount: 5
    },
    configStatus: {
        database: { status: 'ok', latency: 23, message: '正常' },
        redis: { status: 'ok', latency: 5, message: '正常' },
        fileSystem: { status: 'ok', message: '正常' },
        email: { status: 'warning', message: '未配置' },
        oss: { status: 'warning', message: '未配置' }
    },
    addonList: [
        { name: 'admin', title: '管理后台', version: '1.0.0', description: '系统核心管理功能模块', enabled: true },
        { name: 'demo', title: '示例插件', version: '1.0.0', description: '演示插件开发示例', enabled: true },
        { name: 'befly', title: '核心功能', version: '1.0.0', description: 'Befly 框架核心功能', enabled: true }
    ],
    // 系统资源监控
    systemResources: {
        cpu: { usage: 45, cores: 8 },
        memory: { used: 6.5, total: 16, percentage: 40.6 },
        disk: { used: 256, total: 512, percentage: 50 },
        network: { upload: 1.2, download: 3.5 }
    },
    // 数据库统计
    databaseStats: {
        tableCount: 28,
        totalRows: 15678,
        databaseSize: '128 MB',
        connections: { current: 5, max: 100 }
    },
    // 操作日志
    operationLogs: [
        { user: '管理员', action: '创建角色', target: '编辑人员', time: '2分钟前', status: 'success' },
        { user: '张三', action: '修改菜单', target: '用户管理', time: '15分钟前', status: 'success' },
        { user: '李四', action: '删除接口', target: 'userDelete', time: '1小时前', status: 'warning' },
        { user: '管理员', action: '同步数据库', target: '全部表', time: '2小时前', status: 'success' },
        { user: '王五', action: '登录系统', target: '-', time: '3小时前', status: 'success' }
    ],
    // 待办/通知
    notifications: [
        { type: 'warning', title: '系统更新提醒', content: 'v1.1.0 版本已发布，建议更新', time: '1小时前' },
        { type: 'info', title: '数据备份完成', content: '今日凌晨2点自动备份已完成', time: '6小时前' },
        { type: 'error', title: 'SSL证书即将过期', content: '证书将于30天后过期，请及时更新', time: '1天前' }
    ],
    todoItems: [
        { title: '待审核用户', count: 3, link: '/user' },
        { title: '待处理工单', count: 7, link: '/ticket' },
        { title: '待发布文章', count: 12, link: '/article' }
    ],
    // 性能指标
    performance: {
        avgResponseTime: 125,
        slowestApi: { name: '/addon/admin/menuList', time: 450 },
        totalRequests: 15678,
        successRate: 99.2,
        cacheHitRate: 85.6,
        errorRate: 0.8
    },
    // 环境信息
    environmentInfo: {
        nodeVersion: 'v20.11.0',
        bunVersion: '1.0.25',
        mysqlVersion: '8.0.35',
        redisVersion: '7.2.3',
        os: 'Linux x64',
        platform: 'Ubuntu 22.04 LTS'
    },
    // 快捷操作
    quickActions: [
        { icon: 'Plus', label: '添加菜单', action: 'addMenu', theme: 'primary' },
        { icon: 'UserPlus', label: '添加角色', action: 'addRole', theme: 'success' },
        { icon: 'Database', label: '同步数据库', action: 'syncDb', theme: 'warning' },
        { icon: 'Trash2', label: '清除缓存', action: 'clearCache', theme: 'danger' },
        { icon: 'Download', label: '导出日志', action: 'exportLogs', theme: 'default' },
        { icon: 'Upload', label: '数据备份', action: 'backup', theme: 'primary' }
    ]
});

// 方法集合
const $Method = {
    // 格式化运行时长
    formatUptime(ms) {
        if (!ms) return '-';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}天${hours % 24}小时`;
        } else if (hours > 0) {
            return `${hours}小时${minutes % 60}分钟`;
        } else if (minutes > 0) {
            return `${minutes}分钟`;
        } else {
            return `${seconds}秒`;
        }
    },

    // 获取状态图标
    getStatusIcon(status) {
        const icons = {
            ok: 'CheckCircle',
            warning: 'AlertCircle',
            error: 'XCircle'
        };
        return icons[status] || 'Circle';
    },

    // 获取状态颜色
    getStatusColor(status) {
        const colors = {
            ok: '#52c41a',
            warning: '#faad14',
            error: '#ff4d4f'
        };
        return colors[status] || '#d9d9d9';
    },

    // 获取状态主题
    getStatusTheme(status) {
        const themes = {
            ok: 'success',
            warning: 'warning',
            error: 'danger'
        };
        return themes[status] || 'default';
    },

    // 获取配置项标签
    getConfigLabel(key) {
        const labels = {
            database: '数据库',
            redis: 'Redis',
            fileSystem: '文件系统',
            email: '邮件服务',
            oss: 'OSS存储'
        };
        return labels[key] || key;
    },

    // 获取配置项图标
    getConfigIcon(key) {
        const icons = {
            database: 'Database',
            redis: 'Zap',
            fileSystem: 'HardDrive',
            email: 'Mail',
            oss: 'Cloud'
        };
        return icons[key] || 'Circle';
    },

    // 格式化日期时间
    formatDateTime(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // 处理快捷操作
    handleQuickAction(action) {
        MessagePlugin.info(`执行操作: ${action}`);
        // 实际项目中根据 action 执行相应操作
    },

    // 获取进度条颜色
    getProgressColor(percentage) {
        if (percentage < 50) return 'success';
        if (percentage < 80) return 'warning';
        return 'danger';
    },

    // 获取操作状态图标
    getLogStatusIcon(status) {
        const icons = {
            success: 'CheckCircle',
            warning: 'AlertCircle',
            error: 'XCircle'
        };
        return icons[status] || 'Circle';
    },

    // 获取操作状态颜色
    getLogStatusColor(status) {
        const colors = {
            success: '#52c41a',
            warning: '#faad14',
            error: '#ff4d4f'
        };
        return colors[status] || '#d9d9d9';
    },

    // 获取通知类型图标
    getNotificationIcon(type) {
        const icons = {
            info: 'Info',
            warning: 'AlertTriangle',
            error: 'AlertCircle',
            success: 'CheckCircle'
        };
        return icons[type] || 'Bell';
    }
};
</script>

<style scoped lang="scss">
.dashboard-container {
    background: $bg-color-page;
    height: 100%;
    overflow-y: auto;
}

// 欢迎区域
.welcome-section {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px 24px;
    border-radius: 8px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);

    .welcome-content {
        .welcome-title {
            font-size: 22px;
            font-weight: 600;
            color: white;
            margin: 0 0 4px 0;
        }

        .welcome-desc {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.9);
            margin: 0;
        }
    }

    .welcome-status {
        .status-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 500;

            &.status-online {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                backdrop-filter: blur(10px);
            }
        }
    }
}

// 区块样式
.section-block {
    background: white;
    border-radius: 6px;
    margin-bottom: 12px;
    border: 1px solid $border-color;
    overflow: hidden;

    .section-header {
        background: linear-gradient(to right, #f8f9fa, white);
        padding: 10px 16px;
        border-bottom: 1px solid $primary-color;
        display: flex;
        align-items: center;
        gap: 8px;

        h2 {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: $text-primary;
            flex: 1;
        }
    }

    .section-content {
        padding: 12px;
    }
}

// 信息块
.info-block {
    background: $bg-color-container;
    border: 1px solid $border-color;
    border-radius: 6px;
    padding: 12px;
    height: 100%;

    .info-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-bottom: 8px;
        margin-bottom: 12px;
        border-bottom: 1px solid $primary-color;

        .info-title {
            font-size: 13px;
            font-weight: 600;
            color: $text-primary;
        }
    }

    .info-list {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .info-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 10px;
            background: white;
            border-radius: 4px;
            border: 1px solid $border-color;

            .label {
                font-size: 12px;
                color: $text-secondary;
                font-weight: 500;
            }

            .value {
                font-size: 12px;
                color: $text-primary;
                font-weight: 600;

                &.highlight {
                    color: $primary-color;
                    font-size: 13px;
                }
            }
        }
    }
}

// 统计网格
.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;

    .stat-box {
        background: white;
        border: 1px solid;
        border-radius: 6px;
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s;

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .stat-content {
            flex: 1;

            .stat-value {
                font-size: 20px;
                font-weight: 700;
                margin-bottom: 2px;
            }

            .stat-label {
                font-size: 11px;
                color: $text-secondary;
            }
        }

        &.stat-primary {
            border-color: $primary-color;
            background: linear-gradient(135deg, rgba(0, 82, 217, 0.05), white);

            .stat-value {
                color: $primary-color;
            }
        }

        &.stat-success {
            border-color: $success-color;
            background: linear-gradient(135deg, rgba(82, 196, 26, 0.05), white);

            .stat-value {
                color: $success-color;
            }
        }

        &.stat-warning {
            border-color: $warning-color;
            background: linear-gradient(135deg, rgba(250, 173, 20, 0.05), white);

            .stat-value {
                color: $warning-color;
            }
        }
    }
}

// 配置网格
.config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;

    .config-card {
        background: white;
        border: 1px solid;
        border-radius: 6px;
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        position: relative;
        overflow: hidden;
        transition: all 0.3s;

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .config-icon {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            flex-shrink: 0;
        }

        .config-info {
            flex: 1;
            min-width: 0;

            .config-name {
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 2px;
            }

            .config-status {
                font-size: 11px;
                display: flex;
                align-items: center;
                gap: 4px;

                .latency {
                    margin-left: 4px;
                    color: $text-placeholder;
                }
            }
        }

        .config-badge {
            position: absolute;
            top: 6px;
            right: 6px;
            opacity: 0.2;
        }

        &.config-ok {
            border-color: $success-color;
            background: linear-gradient(135deg, rgba(82, 196, 26, 0.05), white);

            .config-icon {
                background: rgba(82, 196, 26, 0.1);
                color: $success-color;
            }

            .config-name {
                color: $success-color;
            }
        }

        &.config-warning {
            border-color: $warning-color;
            background: linear-gradient(135deg, rgba(250, 173, 20, 0.05), white);

            .config-icon {
                background: rgba(250, 173, 20, 0.1);
                color: $warning-color;
            }

            .config-name {
                color: $warning-color;
            }
        }

        &.config-error {
            border-color: $error-color;
            background: linear-gradient(135deg, rgba(255, 77, 79, 0.05), white);

            .config-icon {
                background: rgba(255, 77, 79, 0.1);
                color: $error-color;
            }

            .config-name {
                color: $error-color;
            }
        }
    }
}

// 插件列表
.addon-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .addon-item {
        background: $bg-color-container;
        border: 1px solid $border-color;
        border-left: 3px solid $primary-color;
        border-radius: 4px;
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.3s;

        &:hover {
            border-left-color: $success-color;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
            transform: translateX(4px);
        }

        .addon-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, $primary-color, #764ba2);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            flex-shrink: 0;
        }

        .addon-info {
            flex: 1;
            min-width: 0;

            .addon-title {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 4px;

                .addon-name {
                    font-size: 13px;
                    font-weight: 600;
                    color: $text-primary;
                }
            }

            .addon-desc {
                font-size: 12px;
                color: $text-secondary;
                line-height: 1.4;
            }
        }

        .addon-status {
            flex-shrink: 0;
        }
    }
}

// 技术栈网格
.tech-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;

    .tech-item {
        background: linear-gradient(135deg, $bg-color-container, white);
        border: 1px solid $border-color;
        border-radius: 4px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        color: $text-primary;
        transition: all 0.3s;

        &:hover {
            border-color: $primary-color;
            background: linear-gradient(135deg, rgba(0, 82, 217, 0.05), white);
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
    }
}

.content-row {
    margin-bottom: 12px;
}

// 系统资源卡片
.resource-card {
    background: $bg-color-container;
    border: 1px solid $border-color;
    border-radius: 6px;
    padding: 12px;
    height: 100%;

    .resource-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 10px;
        font-size: 12px;
        color: $text-secondary;
        font-weight: 500;
    }

    .resource-value {
        font-size: 24px;
        font-weight: 700;
        color: $primary-color;
        margin-bottom: 10px;
    }

    .resource-info {
        font-size: 11px;
        color: $text-placeholder;
        margin-top: 6px;
    }

    .resource-network {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;

        .network-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 10px;
            background: white;
            border-radius: 6px;
            border: 1px solid $border-color;
            font-size: 14px;
            font-weight: 600;
        }
    }
}

// 数据库统计
.database-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;

    .database-item {
        background: white;
        border: 1px solid $border-color;
        border-radius: 6px;
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 10px;

        .db-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, rgba(0, 82, 217, 0.1), rgba(0, 82, 217, 0.05));
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: $primary-color;
        }

        .db-info {
            flex: 1;

            .db-value {
                font-size: 18px;
                font-weight: 700;
                color: $text-primary;
                margin-bottom: 2px;
            }

            .db-label {
                font-size: 11px;
                color: $text-secondary;
            }
        }
    }
}

// 性能指标
.performance-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .perf-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background: white;
        border: 1px solid $border-color;
        border-radius: 4px;

        .perf-label {
            font-size: 12px;
            color: $text-secondary;
        }

        .perf-value {
            font-size: 13px;
            font-weight: 600;
            color: $text-primary;

            &.highlight {
                color: $primary-color;
                font-size: 14px;
            }

            &.success {
                color: $success-color;
            }

            &.error {
                color: $error-color;
            }
        }
    }
}

// 环境信息
.env-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;

    .env-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px;
        background: white;
        border: 1px solid $border-color;
        border-radius: 4px;

        .env-info {
            flex: 1;

            .env-label {
                font-size: 11px;
                color: $text-secondary;
                margin-bottom: 2px;
            }

            .env-value {
                font-size: 12px;
                font-weight: 600;
                color: $text-primary;
            }
        }
    }
}

// 快捷操作
.quick-actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
}

// 操作日志
.operation-list {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .operation-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px;
        background: white;
        border: 1px solid $border-color;
        border-left: 2px solid $primary-color;
        border-radius: 4px;

        .operation-icon {
            padding-top: 2px;
        }

        .operation-content {
            flex: 1;

            .operation-main {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 2px;
                flex-wrap: wrap;

                .operation-user {
                    font-weight: 600;
                    color: $primary-color;
                    font-size: 12px;
                }

                .operation-action {
                    font-size: 12px;
                    color: $text-primary;
                }

                .operation-target {
                    font-size: 12px;
                    color: $text-secondary;
                    background: $bg-color-container;
                    padding: 2px 6px;
                    border-radius: 3px;
                }
            }

            .operation-time {
                font-size: 11px;
                color: $text-placeholder;
            }
        }
    }
}

// 通知和待办
.notification-section,
.todo-section {
    margin-bottom: 12px;

    &:last-child {
        margin-bottom: 0;
    }

    .subsection-title {
        font-size: 13px;
        font-weight: 600;
        color: $text-primary;
        margin: 0 0 8px 0;
        padding-bottom: 6px;
        border-bottom: 1px solid $border-color;
    }
}

.notification-list {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .notification-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px;
        border-radius: 4px;
        border: 1px solid;

        &.notif-info {
            background: rgba(0, 82, 217, 0.05);
            border-color: rgba(0, 82, 217, 0.2);
            color: $primary-color;
        }

        &.notif-warning {
            background: rgba(250, 173, 20, 0.05);
            border-color: rgba(250, 173, 20, 0.2);
            color: $warning-color;
        }

        &.notif-error {
            background: rgba(255, 77, 79, 0.05);
            border-color: rgba(255, 77, 79, 0.2);
            color: $error-color;
        }

        .notification-content {
            flex: 1;

            .notification-title {
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 2px;
            }

            .notification-desc {
                font-size: 11px;
                color: $text-secondary;
                margin-bottom: 2px;
            }

            .notification-time {
                font-size: 10px;
                color: $text-placeholder;
            }
        }
    }
}

.todo-list {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .todo-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px;
        background: white;
        border: 1px solid $border-color;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
            border-color: $primary-color;
            background: rgba(0, 82, 217, 0.05);
            transform: translateX(4px);
        }

        .todo-info {
            display: flex;
            align-items: center;
            gap: 6px;

            .todo-title {
                font-size: 12px;
                color: $text-primary;
            }
        }
    }
}

// 响应式布局
@media (max-width: 768px) {
    .dashboard-container {
        padding: 10px;
    }

    .welcome-section {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
    }

    .stats-grid {
        grid-template-columns: 1fr;
    }

    .config-grid {
        grid-template-columns: 1fr;
    }

    .tech-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
</style>
