<template>
    <div class="section-block">
        <div class="section-header">
            <Icon name="Info" :size="20" />
            <h2>系统概览</h2>
        </div>
        <div class="section-content">
            <t-row :gutter="12">
                <t-col :xs="24" :sm="12" :md="12" :lg="12">
                    <div class="info-block">
                        <div class="stats-grid">
                            <div class="stat-box stat-primary">
                                <Icon name="Menu" :size="24" />
                                <div class="stat-content">
                                    <div class="stat-value">{{ permissionStats.menuCount }}</div>
                                    <div class="stat-label">菜单总数</div>
                                </div>
                            </div>
                            <div class="stat-box stat-success">
                                <Icon name="Webhook" :size="24" />
                                <div class="stat-content">
                                    <div class="stat-value">{{ permissionStats.apiCount }}</div>
                                    <div class="stat-label">接口总数</div>
                                </div>
                            </div>
                            <div class="stat-box stat-warning">
                                <Icon name="Users" :size="24" />
                                <div class="stat-content">
                                    <div class="stat-value">{{ permissionStats.roleCount }}</div>
                                    <div class="stat-label">角色总数</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </t-col>
            </t-row>
        </div>
    </div>
</template>

<script setup>
// 组件内部数据
const systemInfo = $ref({
    systemName: 'Befly Admin',
    version: 'v1.0.0',
    environment: 'Production'
});

const permissionStats = $ref({
    menuCount: 0,
    apiCount: 0,
    roleCount: 0
});

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http('/addon/admin/dashboardSystemOverview');
        Object.assign(systemInfo, data.systemInfo);
        Object.assign(permissionStats, data.permissionStats);
    } catch (error) {
        console.error('获取系统概览失败:', error);
    }
};

fetchData();

// 工具函数
const formatUptime = (ms) => {
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
};

const formatDateTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};
</script>

<style scoped lang="scss">
.info-block {
    background: transparent;
    border: none;
    padding: 0;
    height: 100%;

    .info-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-bottom: 8px;
        margin-bottom: 12px;
        border-bottom: 2px solid $primary-color;

        .info-title {
            font-size: 14px;
            font-weight: 600;
            color: $text-primary;
        }
    }

    .info-grid-compact {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;

        .info-grid-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            background: rgba($primary-color, 0.02);
            border-radius: $border-radius-small;
            border: 1px solid $border-color;
            transition: all 0.2s ease;

            &:hover {
                background: rgba($primary-color, 0.05);
                border-color: $primary-color;
            }

            .label {
                font-size: 14px;
                color: $text-secondary;
                font-weight: 500;
            }

            .value {
                font-size: 14px;
                color: $text-primary;
                font-weight: 600;

                &.highlight {
                    color: $primary-color;
                }
            }
        }
    }
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;

    .stat-box {
        background: rgba($primary-color, 0.02);
        border: 1px solid $border-color;
        border-radius: 6px;
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s;

        &:hover {
            background: rgba($primary-color, 0.05);
            border-color: $primary-color;
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
                font-size: 14px;
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
</style>
