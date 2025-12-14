<template>
    <div class="section-block">
        <div class="section-header flex items-center gap-2">
            <ILucideInfo />
            <h2>系统概览</h2>
        </div>
        <div class="section-content">
            <div class="info-block">
                <div class="stats-grid">
                    <div class="stat-box stat-primary">
                        <ILucideMenu />
                        <div class="stat-content">
                            <div class="stat-value">{{ permissionStats.menuCount }}</div>
                            <div class="stat-label">菜单总数</div>
                        </div>
                    </div>
                    <div class="stat-box stat-success">
                        <ILucideWebhook />
                        <div class="stat-content">
                            <div class="stat-value">{{ permissionStats.apiCount }}</div>
                            <div class="stat-label">接口总数</div>
                        </div>
                    </div>
                    <div class="stat-box stat-warning">
                        <ILucideUsers />
                        <div class="stat-content">
                            <div class="stat-value">{{ permissionStats.roleCount }}</div>
                            <div class="stat-label">角色总数</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import ILucideInfo from '~icons/lucide/info';
import ILucideMenu from '~icons/lucide/menu';
import ILucideWebhook from '~icons/lucide/webhook';
import ILucideUsers from '~icons/lucide/users';
import { $Http } from '@/plugins/http';

// 组件内部数据
const permissionStats = $ref({
    menuCount: 0,
    apiCount: 0,
    roleCount: 0
});

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http('/addon/admin/dashboard/systemOverview');
        Object.assign(permissionStats, data);
    } catch (error) {
        // 静默失败：不阻断页面展示
    }
};

fetchData();
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
        border-bottom: 2px solid var(--primary-color);

        .info-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
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
            background: rgba(var(--primary-color-rgb), 0.02);
            border-radius: var(--border-radius-small);
            border: 1px solid var(--border-color);
            transition: all 0.2s ease;

            &:hover {
                background: rgba(var(--primary-color-rgb), 0.05);
                border-color: var(--primary-color);
            }

            .label {
                font-size: 14px;
                color: var(--text-secondary);
                font-weight: 500;
            }

            .value {
                font-size: 14px;
                color: var(--text-primary);
                font-weight: 600;

                &.highlight {
                    color: var(--primary-color);
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
        background: rgba(var(--primary-color-rgb), 0.02);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s;

        &:hover {
            background: rgba(var(--primary-color-rgb), 0.05);
            border-color: var(--primary-color);
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
                color: var(--text-secondary);
            }
        }

        &.stat-primary {
            border-color: var(--primary-color);
            background: linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.05), white);

            .stat-value {
                color: var(--primary-color);
            }
        }

        &.stat-success {
            border-color: var(--success-color);
            background: linear-gradient(135deg, rgba(var(--success-color-rgb), 0.05), white);

            .stat-value {
                color: var(--success-color);
            }
        }

        &.stat-warning {
            border-color: var(--warning-color);
            background: linear-gradient(135deg, rgba(var(--warning-color-rgb), 0.05), white);

            .stat-value {
                color: var(--warning-color);
            }
        }
    }
}
</style>
