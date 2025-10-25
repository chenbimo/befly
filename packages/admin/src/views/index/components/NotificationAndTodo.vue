<template>
    <div class="dual-section-container">
        <!-- 系统通知 -->
        <div class="section-block">
            <div class="section-header">
                <Icon name="Bell" :size="20" />
                <h2>系统通知</h2>
                <t-tag theme="primary" variant="outline" size="small">{{ notifications.length }}</t-tag>
            </div>
            <div class="section-content">
                <div class="notification-compact-list">
                    <div v-for="notification in notifications" :key="notification.id" class="notification-compact-item">
                        <div class="notification-icon" :class="`type-${notification.type}`">
                            <Icon :name="getNotificationIcon(notification.type)" :size="16" />
                        </div>
                        <div class="notification-content">
                            <span class="notification-title">{{ notification.title }}</span>
                            <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
                        </div>
                        <t-tag v-if="!notification.isRead" theme="primary" size="small" variant="light"> 新 </t-tag>
                    </div>
                </div>
            </div>
        </div>

        <!-- 待办事项 -->
        <div class="section-block">
            <div class="section-header">
                <Icon name="CheckSquare" :size="20" />
                <h2>待办事项</h2>
                <t-tag theme="warning" variant="outline" size="small">{{ todoList.filter((t) => !t.completed).length }}</t-tag>
            </div>
            <div class="section-content">
                <div class="todo-compact-list">
                    <div v-for="todo in todoList" :key="todo.id" class="todo-compact-item" :class="{ completed: todo.completed }">
                        <t-checkbox :checked="todo.completed" :disabled="true" />
                        <div class="todo-content">
                            <span class="todo-title">{{ todo.title }}</span>
                            <span class="todo-deadline">{{ formatDate(todo.deadline) }}</span>
                        </div>
                        <t-tag :theme="getPriorityTheme(todo.priority)" size="small" variant="light">
                            {{ getPriorityText(todo.priority) }}
                        </t-tag>
                    </div>
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

const todoList = $ref([
    { id: 1, title: '审核待处理用户申请', priority: 'high', deadline: Date.now() + 86400000, completed: false },
    { id: 2, title: '处理客户工单反馈', priority: 'medium', deadline: Date.now() + 172800000, completed: false },
    { id: 3, title: '发布本周文章内容', priority: 'medium', deadline: Date.now() + 259200000, completed: false },
    { id: 4, title: '系统安全检查', priority: 'high', deadline: Date.now() + 432000000, completed: true },
    { id: 5, title: '数据统计报表', priority: 'low', deadline: Date.now() + 604800000, completed: false }
]);

const getNotificationIcon = (type) => {
    const iconMap = {
        info: 'Info',
        success: 'CheckCircle',
        warning: 'AlertTriangle',
        error: 'XCircle'
    };
    return iconMap[type] || 'Bell';
};

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

const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
};

const getPriorityTheme = (priority) => {
    const themeMap = {
        high: 'danger',
        medium: 'warning',
        low: 'success'
    };
    return themeMap[priority] || 'default';
};

const getPriorityText = (priority) => {
    const textMap = {
        high: '高',
        medium: '中',
        low: '低'
    };
    return textMap[priority] || '普通';
};
</script>

<style scoped lang="scss">
.dual-section-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.notification-compact-list {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .notification-compact-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: $bg-color-container;
        border-radius: 6px;
        border: 1px solid $border-color;
        transition: all 0.2s ease;

        &:hover {
            background: rgba($primary-color, 0.02);
            border-color: rgba($primary-color, 0.2);
        }

        .notification-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 6px;
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
            gap: 10px;
            flex: 1;
            min-width: 0;

            .notification-title {
                font-size: 13px;
                color: $text-primary;
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }

            .notification-time {
                font-size: 12px;
                color: $text-placeholder;
                flex-shrink: 0;
            }
        }
    }
}

.todo-compact-list {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .todo-compact-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: $bg-color-container;
        border-radius: 6px;
        border: 1px solid $border-color;
        transition: all 0.2s ease;

        &:hover {
            background: rgba($primary-color, 0.02);
            border-color: rgba($primary-color, 0.2);
        }

        &.completed {
            opacity: 0.6;

            .todo-title {
                text-decoration: line-through;
                color: $text-placeholder;
            }
        }

        .todo-content {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
            min-width: 0;

            .todo-title {
                font-size: 13px;
                color: $text-primary;
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }

            .todo-deadline {
                font-size: 12px;
                color: $text-placeholder;
                flex-shrink: 0;
            }
        }
    }
}
</style>
