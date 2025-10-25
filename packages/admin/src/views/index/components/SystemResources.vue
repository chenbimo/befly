<template>
    <div class="section-block">
        <div class="section-header">
            <Icon name="Activity" :size="20" />
            <h2>系统资源</h2>
        </div>
        <div class="section-content">
            <div class="resource-compact-list">
                <div class="resource-compact-item">
                    <div class="resource-compact-header">
                        <Icon name="Cpu" :size="16" />
                        <span class="resource-label">CPU</span>
                        <span class="resource-value">{{ systemResources.cpu.usage }}%</span>
                        <span class="resource-desc">{{ systemResources.cpu.cores }}核心</span>
                    </div>
                    <t-progress :percentage="systemResources.cpu.usage" :theme="getProgressColor(systemResources.cpu.usage)" size="small" />
                </div>
                <div class="resource-compact-item">
                    <div class="resource-compact-header">
                        <Icon name="HardDrive" :size="16" />
                        <span class="resource-label">内存</span>
                        <span class="resource-value">{{ systemResources.memory.percentage }}%</span>
                        <span class="resource-desc">{{ systemResources.memory.used }}GB / {{ systemResources.memory.total }}GB</span>
                    </div>
                    <t-progress :percentage="systemResources.memory.percentage" :theme="getProgressColor(systemResources.memory.percentage)" size="small" />
                </div>
                <div class="resource-compact-item">
                    <div class="resource-compact-header">
                        <Icon name="Disc" :size="16" />
                        <span class="resource-label">磁盘</span>
                        <span class="resource-value">{{ systemResources.disk.percentage }}%</span>
                        <span class="resource-desc">{{ systemResources.disk.used }}GB / {{ systemResources.disk.total }}GB</span>
                    </div>
                    <t-progress :percentage="systemResources.disk.percentage" :theme="getProgressColor(systemResources.disk.percentage)" size="small" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
// 组件内部数据
const systemResources = $ref({
    cpu: { usage: 0, cores: 0 },
    memory: { used: 0, total: 0, percentage: 0 },
    disk: { used: 0, total: 0, percentage: 0 }
});

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http('/addon/admin/dashboardSystemResources');
        Object.assign(systemResources, data);
    } catch (error) {
        console.error('获取系统资源失败:', error);
    }
};

fetchData();

// 工具函数
const getProgressColor = (percentage) => {
    if (percentage < 50) return 'success';
    if (percentage < 80) return 'warning';
    return 'danger';
};
</script>

<style scoped lang="scss">
.resource-compact-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: $spacing-md;

    .resource-compact-item {
        .resource-compact-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;

            .resource-label {
                font-size: 14px;
                font-weight: 600;
                color: $text-secondary;
                min-width: 50px;
            }

            .resource-value {
                font-size: 16px;
                font-weight: 700;
                color: $primary-color;
                min-width: 60px;
            }

            .resource-desc {
                font-size: 14px;
                color: $text-placeholder;
                flex: 1;
            }
        }
    }
}
</style>
