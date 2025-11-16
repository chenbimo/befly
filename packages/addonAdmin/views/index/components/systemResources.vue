<template>
    <div class="section-block">
        <div class="section-header flex items-center gap-2">
            <ILucideActivity />
            <h2>系统资源</h2>
        </div>
        <div class="section-content">
            <div class="resource-compact-list">
                <div class="resource-compact-item">
                    <div class="resource-compact-header">
                        <ILucideCpu />
                        <span class="resource-label">CPU</span>
                        <span class="resource-value">{{ systemResources.cpu.usage }}%</span>
                        <span class="resource-desc">{{ systemResources.cpu.cores }}核心</span>
                    </div>
                    <TProgress :percentage="systemResources.cpu.usage" :status="getProgressColor(systemResources.cpu.usage)" />
                </div>
                <div class="resource-compact-item">
                    <div class="resource-compact-header">
                        <ILucideHardDrive />
                        <span class="resource-label">内存</span>
                        <span class="resource-value">{{ systemResources.memory.percentage }}%</span>
                        <span class="resource-desc">{{ systemResources.memory.used }}GB / {{ systemResources.memory.total }}GB</span>
                    </div>
                    <TProgress :percentage="systemResources.memory.percentage" :status="getProgressColor(systemResources.memory.percentage)" />
                </div>
                <div class="resource-compact-item">
                    <div class="resource-compact-header">
                        <ILucideDisc />
                        <span class="resource-label">磁盘</span>
                        <span class="resource-value">{{ systemResources.disk.percentage }}%</span>
                        <span class="resource-desc">{{ systemResources.disk.used }}GB / {{ systemResources.disk.total }}GB</span>
                    </div>
                    <TProgress :percentage="systemResources.disk.percentage" :status="getProgressColor(systemResources.disk.percentage)" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { Progress as TProgress } from 'tdesign-vue-next';
import ILucideActivity from '~icons/lucide/activity';
import ILucideCpu from '~icons/lucide/cpu';
import ILucideHardDrive from '~icons/lucide/hard-drive';
import ILucideDisc from '~icons/lucide/disc';
import { $Http } from '@/plugins/http';

// 组件内部数据
const systemResources = $ref({
    cpu: { usage: 0, cores: 0 },
    memory: { used: 0, total: 0, percentage: 0 },
    disk: { used: 0, total: 0, percentage: 0 }
});

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http('/addon/admin/dashboard/systemResources');
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
.resources-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);

    .resource-item {
        text-align: center;
        padding: 20px;
        border-radius: 8px;
        transition: all 0.3s;

        .resource-icon {
            font-size: 32px;
            margin-bottom: 8px;
            color: var(--text-secondary);
        }

        .resource-label {
            font-size: 14px;
            margin-bottom: 4px;
            color: var(--primary-color);
        }

        .resource-value {
            font-size: 20px;
            font-weight: 600;
            color: var(--text-placeholder);
</style>
