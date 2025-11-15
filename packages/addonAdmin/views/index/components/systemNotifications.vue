<template>
    <div class="section-block">
        <div class="section-header flex items-center gap-2">
            <IconLucideBell />
            <h2>系统通知</h2>
        </div>
        <div class="section-content">
            <div class="notification-compact-list">
                <div v-for="notification in notifications" :key="notification.id" class="notification-compact-item">
                    <div class="notification-icon" :class="`type-${notification.type}`">
                        <IconLucideInfo v-if="notification.type === 'info'" />
                        <IconLucideCheckCircle v-else-if="notification.type === 'success'" />
                        <IconLucideAlertTriangle v-else-if="notification.type === 'warning'" />
                        <IconLucideXCircle v-else-if="notification.type === 'error'" />
                        <IconLucideBell v-else />
                    </div>
                    <div class="notification-content">
                        <span class="notification-title">{{ notification.title }}</span>
                        <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
                    </div>
                    <t-tag v-if="!notification.isRead" type="primary" size="small">新</t-tag>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
// 组件内部数据
const notifications = $ref([
    { id: 1, type: 'warning', title: '系统更新提醒 - v1.1.0 版本已发布', isRead: false, createdAt: Date.now() - 3600000 },
    { id: 2, type: 'info', title: '数据备份完成 - 今日凌晨自动备份成功', isRead: true, createdAt: Date.now() - 21600000 },
    { id: 3, type: 'error', title: 'SSL证书即将过期 - 请及时更新证书', isRead: false, createdAt: Date.now() - 86400000 },
    { id: 4, type: 'success', title: '性能优化完成 - 响应速度提升30%', isRead: true, createdAt: Date.now() - 172800000 }
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
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}-${day}`;
    }
};
</script>

<style scoped lang="scss">
.notification-compact-list {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;

    .notification-compact-item {
        display: flex;
        align-items: center;
        gap: $spacing-sm;
        padding: $spacing-sm $spacing-md;
        background: rgba($primary-color, 0.02);
        border-radius: $border-radius-small;
        border: 1px solid $border-color;
        transition: all 0.2s ease;

        &:hover {
            background: rgba($primary-color, 0.05);
            border-color: $primary-color;
        }

        .notification-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: $border-radius-small;
            flex-shrink: 0;

            &.type-info {
                background: rgba($primary-color, 0.1);
                color: $primary-color;
            }

            &.type-success {
                background: rgba($success-color, 0.1);
                color: $success-color;
            }

            &.type-warning {
                background: rgba($warning-color, 0.1);
                color: $warning-color;
            }

            &.type-error {
                background: rgba($error-color, 0.1);
                color: $error-color;
            }
        }

        .notification-content {
            display: flex;
            align-items: center;
            gap: $spacing-sm;
            flex: 1;
            min-width: 0;

            .notification-title {
                font-size: 14px;
                color: $text-primary;
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }

            .notification-time {
                font-size: 14px;
                color: $text-placeholder;
                flex-shrink: 0;
            }
        }
    }
}
</style>
