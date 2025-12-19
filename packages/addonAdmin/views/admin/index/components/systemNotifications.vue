<template>
    <div class="section-block">
        <div class="section-header flex items-center gap-2">
            <ILucideBell />
            <h2>系统通知</h2>
        </div>
        <div class="section-content">
            <div class="notification-compact-list">
                <div v-for="notification in notifications" :key="notification.id" class="notification-compact-item">
                    <div class="notification-icon" :class="`type-${notification.type}`">
                        <ILucideInfo v-if="notification.type === 'info'" />
                        <ILucideCheckCircle v-else-if="notification.type === 'success'" />
                        <ILucideAlertTriangle v-else-if="notification.type === 'warning'" />
                        <ILucideXCircle v-else-if="notification.type === 'error'" />
                        <ILucideBell v-else />
                    </div>
                    <div class="notification-content">
                        <span class="notification-title">{{ notification.title }}</span>
                        <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
                    </div>
                    <TTag v-if="!notification.isRead" type="primary" size="small">新</TTag>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { Tag as TTag } from "tdesign-vue-next";
import ILucideBell from "~icons/lucide/bell";
import ILucideInfo from "~icons/lucide/info";
import ILucideCheckCircle from "~icons/lucide/check-circle";
import ILucideAlertTriangle from "~icons/lucide/alert-triangle";
import ILucideXCircle from "~icons/lucide/x-circle";

// 组件内部数据
const notifications = $ref([
    { id: 1, type: "warning", title: "系统更新提醒 - v1.1.0 版本已发布", isRead: false, createdAt: Date.now() - 3600000 },
    { id: 2, type: "info", title: "数据备份完成 - 今日凌晨自动备份成功", isRead: true, createdAt: Date.now() - 21600000 },
    { id: 3, type: "error", title: "SSL证书即将过期 - 请及时更新证书", isRead: false, createdAt: Date.now() - 86400000 },
    { id: 4, type: "success", title: "性能优化完成 - 响应速度提升30%", isRead: true, createdAt: Date.now() - 172800000 }
]);

const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`;
    } else {
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${month}-${day}`;
    }
};
</script>

<style scoped lang="scss">
.notification-compact-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);

    .notification-compact-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        background: rgba(var(--primary-color-rgb), 0.02);
        border-radius: var(--border-radius-small);
        border: 1px solid var(--border-color);
        transition: all 0.2s;

        &:hover {
            background: rgba(var(--primary-color-rgb), 0.05);
            border-color: var(--primary-color);
        }

        .notification-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: var(--border-radius-small);
            flex-shrink: 0;

            &.type-info {
                background: rgba(var(--primary-color-rgb), 0.1);
                color: var(--primary-color);
            }

            &.type-success {
                background: rgba(var(--success-color-rgb), 0.1);
                color: var(--success-color);
            }

            &.type-warning {
                background: rgba(var(--warning-color-rgb), 0.1);
                color: var(--warning-color);
            }

            &.type-error {
                background: rgba(var(--error-color-rgb), 0.1);
                color: var(--error-color);
            }
        }

        .notification-content {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
            flex: 1;
            min-width: 0;

            .notification-title {
                font-size: 14px;
                color: var(--text-primary);
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }

            .notification-time {
                font-size: 14px;
                color: var(--text-placeholder);
                flex-shrink: 0;
            }
        }
    }
}
</style>
