<template>
    <div class="dashboard-container">
        <SystemOverview />
        <ServiceStatus />
        <SystemResources />
        <PerformanceMetrics />
        <EnvironmentInfo />
    </div>
</template>

<script setup>
import SystemOverview from './components/systemOverview.vue';
import ServiceStatus from './components/serviceStatus.vue';
import SystemResources from './components/systemResources.vue';
import PerformanceMetrics from './components/performanceMetrics.vue';
import EnvironmentInfo from './components/environmentInfo.vue';
</script>

<style scoped lang="scss">
.dashboard-container {
    display: flex;
    flex-direction: column;
    gap: var(--layout-gap);
    overflow-y: auto;
    height: 100%;
    padding: 0;

    // 每个组件都是独立的卡片
    :deep(.section-block) {
        background: var(--bg-color-container);
        border-radius: var(--card-radius);
        box-shadow: var(--shadow-1);
        padding: var(--spacing-md);
        border: none;
    }
}
</style>
