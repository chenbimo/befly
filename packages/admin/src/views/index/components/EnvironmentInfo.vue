<template>
    <div class="section-block">
        <div class="section-header">
            <Icon name="Server" :size="20" />
            <h2>运行环境</h2>
        </div>
        <div class="section-content">
            <div class="env-grid-compact">
                <div class="env-compact-item">
                    <span class="env-label">操作系统</span>
                    <span class="env-value">{{ environmentInfo.os }}</span>
                </div>
                <div class="env-compact-item">
                    <span class="env-label">服务器</span>
                    <span class="env-value">{{ environmentInfo.server }}</span>
                </div>
                <div class="env-compact-item">
                    <span class="env-label">Node版本</span>
                    <span class="env-value">{{ environmentInfo.nodeVersion }}</span>
                </div>
                <div class="env-compact-item">
                    <span class="env-label">数据库</span>
                    <span class="env-value">{{ environmentInfo.database }}</span>
                </div>
                <div class="env-compact-item">
                    <span class="env-label">缓存</span>
                    <span class="env-value">{{ environmentInfo.cache }}</span>
                </div>
                <div class="env-compact-item">
                    <span class="env-label">时区</span>
                    <span class="env-value">{{ environmentInfo.timezone }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
// 组件内部数据
const environmentInfo = $ref({
    os: '',
    server: '',
    nodeVersion: '',
    database: '',
    cache: '',
    timezone: ''
});

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http('/core/admin/dashboard/environmentInfo');
        Object.assign(environmentInfo, data);
    } catch (error) {
        console.error('获取运行环境信息失败:', error);
    }
};

fetchData();
</script>

<style scoped lang="scss">
.env-grid-compact {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;

    .env-compact-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        background: $bg-color-container;
        border-radius: 6px;
        border: 1px solid $border-color;
        transition: all 0.2s ease;

        &:hover {
            background: rgba($primary-color, 0.03);
            border-color: rgba($primary-color, 0.2);
        }

        .env-label {
            font-size: 14px;
            color: $text-secondary;
            font-weight: 500;
        }

        .env-value {
            font-size: 14px;
            color: $text-primary;
            font-weight: 600;
            text-align: right;
        }
    }
}
</style>
