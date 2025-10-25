<template>
    <div class="section-block">
        <div class="section-header">
            <Icon name="Zap" :size="20" />
            <h2>快捷操作</h2>
        </div>
        <div class="section-content">
            <div class="quick-actions-grid">
                <div v-for="action in quickActions" :key="action.name" class="quick-action-item" @click="handleAction(action)">
                    <div class="action-icon" :style="{ background: action.color }">
                        <Icon :name="action.icon" :size="20" />
                    </div>
                    <div class="action-info">
                        <div class="action-name">{{ action.name }}</div>
                        <div class="action-desc">{{ action.description }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
// 组件内部数据
const quickActions = $ref([
    { name: '添加菜单', icon: 'Plus', description: '快速添加', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', action: 'addMenu' },
    { name: '添加角色', icon: 'UserPlus', description: '权限管理', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', action: 'addRole' },
    { name: '同步数据库', icon: 'Database', description: '数据同步', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', action: 'syncDb' },
    { name: '清除缓存', icon: 'Trash2', description: '清理缓存', color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', action: 'clearCache' },
    { name: '导出日志', icon: 'Download', description: '下载日志', color: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', action: 'exportLogs' },
    { name: '数据备份', icon: 'Upload', description: '备份数据', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', action: 'backup' },
    { name: '系统设置', icon: 'Settings', description: '配置管理', color: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', action: 'settings' },
    { name: '查看文档', icon: 'BookOpen', description: '帮助文档', color: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', action: 'docs' }
]);

const emit = defineEmits(['action-click']);

const handleAction = (action) => {
    emit('action-click', action);
};
</script>

<style scoped lang="scss">
.quick-actions-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;

    .quick-action-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: $bg-color-container;
        border-radius: 8px;
        border: 1px solid $border-color;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border-color: $primary-color;
        }

        .action-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 8px;
            color: white;
            flex-shrink: 0;
        }

        .action-info {
            flex: 1;
            min-width: 0;

            .action-name {
                font-size: 14px;
                font-weight: 600;
                color: $text-primary;
                margin-bottom: 2px;
            }

            .action-desc {
                font-size: 12px;
                color: $text-placeholder;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }
    }
}
</style>
