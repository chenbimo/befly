<template>
    <div class="section-block">
        <div class="section-header flex items-center gap-2">
            <i-lucide:file-text />
            <h2>操作日志</h2>
        </div>
        <div class="section-content">
            <div class="operation-table">
                <div class="operation-header">
                    <span class="col-time">时间</span>
                    <span class="col-user">操作人</span>
                    <span class="col-action">操作</span>
                    <span class="col-module">模块</span>
                    <span class="col-ip">IP地址</span>
                    <span class="col-status">状态</span>
                </div>
                <div class="operation-body">
                    <div v-for="log in operationLogs" :key="log.id" class="operation-row">
                        <span class="col-time">{{ formatTime(log.createdAt) }}</span>
                        <span class="col-user">{{ log.userName }}</span>
                        <span class="col-action">{{ log.action }}</span>
                        <span class="col-module">{{ log.module }}</span>
                        <span class="col-ip">{{ log.ip }}</span>
                        <span class="col-status">
                            <t-tag :type="log.status === 'success' ? 'success' : 'danger'" size="small">
                                {{ log.status === 'success' ? '成功' : '失败' }}
                            </t-tag>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
// 组件内部数据
const operationLogs = $ref([
    { id: 1, userName: '管理员', action: '创建角色', module: '权限管理', ip: '192.168.1.100', status: 'success', createdAt: Date.now() - 120000 },
    { id: 2, userName: '张三', action: '修改菜单', module: '系统设置', ip: '192.168.1.101', status: 'success', createdAt: Date.now() - 900000 },
    { id: 3, userName: '李四', action: '删除接口', module: '接口管理', ip: '192.168.1.102', status: 'failed', createdAt: Date.now() - 3600000 },
    { id: 4, userName: '管理员', action: '同步数据库', module: '数据库', ip: '192.168.1.100', status: 'success', createdAt: Date.now() - 7200000 },
    { id: 5, userName: '王五', action: '登录系统', module: '系统', ip: '192.168.1.103', status: 'success', createdAt: Date.now() - 10800000 }
]);

const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
};
</script>

<style scoped lang="scss">
.operation-table {
    .operation-header,
    .operation-row {
        display: grid;
        grid-template-columns: 100px 100px 1fr 120px 120px 80px;
        gap: 12px;
        align-items: center;
    }

    .operation-header {
        padding: 10px 12px;
        background: linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.05) 0%, rgba(var(--primary-color-rgb), 0.02) 100%);
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 6px;
    }

    .operation-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .operation-row {
        padding: 10px 12px;
        background: $bg-color-container;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        font-size: 14px;
        transition: all 0.2s ease;

        &:hover {
            background: rgba(var(--primary-color-rgb), 0.02);
            border-color: rgba(var(--primary-color-rgb), 0.2);
        }

        .col-time {
            color: var(--text-secondary);
            font-size: 14px;
        }

        .col-user,
        .col-action,
        .col-module,
        .col-ip {
            color: var(--text-primary);
        }

        .col-action {
            font-weight: 600;
        }
    }
}
</style>
