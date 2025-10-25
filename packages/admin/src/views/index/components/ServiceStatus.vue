<template>
    <div class="section-block">
        <div class="section-header">
            <Icon name="Settings" :size="20" />
            <h2>服务状态</h2>
        </div>
        <div class="section-content">
            <div class="config-grid">
                <div v-for="(item, key) in configStatus" :key="key" class="config-card" :class="`config-${item.status}`">
                    <div class="config-icon">
                        <Icon :name="getConfigIcon(key)" :size="20" />
                    </div>
                    <div class="config-info">
                        <div class="config-name">{{ getConfigLabel(key) }}</div>
                        <div class="config-status">
                            {{ item.message }}
                            <span v-if="item.latency" class="latency">{{ item.latency }}ms</span>
                        </div>
                    </div>
                    <div class="config-badge">
                        <Icon :name="getStatusIcon(item.status)" :size="32" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
// 组件内部数据
const configStatus = $ref({
    database: { status: 'ok', latency: 23, message: '正常' },
    redis: { status: 'ok', latency: 5, message: '正常' },
    fileSystem: { status: 'ok', message: '正常' },
    email: { status: 'warning', message: '未配置' },
    oss: { status: 'warning', message: '未配置' }
});

// 工具函数
const getConfigLabel = (key) => {
    const labels = {
        database: '数据库',
        redis: 'Redis',
        fileSystem: '文件系统',
        email: '邮件服务',
        oss: 'OSS存储'
    };
    return labels[key] || key;
};

const getConfigIcon = (key) => {
    const icons = {
        database: 'Database',
        redis: 'Zap',
        fileSystem: 'HardDrive',
        email: 'Mail',
        oss: 'Cloud'
    };
    return icons[key] || 'Circle';
};

const getStatusIcon = (status) => {
    const icons = {
        ok: 'CheckCircle',
        warning: 'AlertCircle',
        error: 'XCircle'
    };
    return icons[status] || 'Circle';
};
</script>

<style scoped lang="scss">
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
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 2px;
            }

            .config-status {
                font-size: 14px;
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
</style>
