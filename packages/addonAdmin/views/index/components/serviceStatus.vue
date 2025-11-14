<template>
    <div class="section-block">
        <div class="section-header flex items-center gap-2">
            <IconLucideCheckCircle />
            <h2>服务状态</h2>
        </div>
        <div class="section-content">
            <div class="config-grid">
                <div v-for="service in services" :key="service.name" class="config-card" :class="`config-${service.status}`">
                    <div class="config-icon">
                        <IconLucideDatabase v-if="service.name === '数据库'" style="width: 20px; height: 20px" />
                        <IconLucideZap v-else-if="service.name === 'Redis'" style="width: 20px; height: 20px" />
                        <IconLucideHardDrive v-else-if="service.name === '文件系统'" style="width: 20px; height: 20px" />
                        <IconLucideMail v-else-if="service.name === '邮件服务'" style="width: 20px; height: 20px" />
                        <IconLucideCloud v-else-if="service.name === 'OSS存储'" style="width: 20px; height: 20px" />
                        <IconLucideCircle v-else style="width: 20px; height: 20px" />
                    </div>
                    <div class="config-info">
                        <div class="config-name">{{ service.name }}</div>
                        <div class="config-status">
                            {{ getStatusText(service.status) }}
                            <span v-if="service.responseTime && service.responseTime !== '-'" class="latency">{{ service.responseTime }}</span>
                        </div>
                    </div>
                    <div class="config-badge">
                        <IconLucideCheckCircle v-if="service.status === 'running'" style="width: 32px; height: 32px" />
                        <IconLucideXCircle v-else-if="service.status === 'stopped'" style="width: 32px; height: 32px" />
                        <IconLucideAlertCircle v-else-if="service.status === 'unconfigured'" style="width: 32px; height: 32px" />
                        <IconLucideCircle v-else style="width: 32px; height: 32px" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import IconLucideCheckCircle from '~icons/lucide/check-circle';
import IconLucideZap from '~icons/lucide/zap';
import IconLucideCloud from '~icons/lucide/cloud';
import IconLucideCircle from '~icons/lucide/circle';
import IconLucideXCircle from '~icons/lucide/x-circle';
import IconLucideCheck from '~icons/lucide/check';
import IconLucideX from '~icons/lucide/x';
import IconLucideAlertCircle from '~icons/lucide/alert-circle';
import IconLucideDatabase from '~icons/lucide/database';
import IconLucideMail from '~icons/lucide/mail';
import IconLucideHardDrive from '~icons/lucide/hard-drive';

// 组件内部数据
const services = $ref([]);

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http('/addon/admin/dashboard/serviceStatus');
        services.splice(0, services.length, ...data.services);
    } catch (error) {
        console.error('获取服务状态失败:', error);
    }
};

fetchData();

// 工具函数
const getStatusColor = (status) => {
    const colors = {
        running: 'success',
        stopped: 'error',
        unconfigured: 'warning'
    };
    return colors[status] || 'default';
};

const getStatusText = (status) => {
    const texts = {
        running: '正常',
        stopped: '停止',
        unconfigured: '未配置'
    };
    return texts[status] || status;
};
</script>

<style scoped lang="scss">
.config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;

    .config-card {
        background: rgba($primary-color, 0.02);
        border: 1px solid $border-color;
        border-radius: 6px;
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        position: relative;
        overflow: hidden;
        transition: all 0.3s;

        &:hover {
            background: rgba($primary-color, 0.05);
            border-color: $primary-color;
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

        &.config-running {
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

        &.config-unconfigured {
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

        &.config-stopped {
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
