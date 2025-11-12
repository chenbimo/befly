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
    gap: 12px;
    overflow-y: auto;
    height: 100%;
    background-color: #fff;
    padding: 15px;
    border: 1px solid #e8eaed;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    border-radius: 8px;
}
</style>
