<template>
    <div class="dashboard-container">
        <div class="dashboard-left">
            <SystemOverview />
            <ServiceStatus />
            <SystemResources />
            <PerformanceMetrics />
            <EnvironmentInfo />
        </div>
        <div class="dashboard-right">
            <UserInfo />
            <AddonList />
        </div>
    </div>
</template>

<script setup>
import SystemOverview from './components/systemOverview.vue';
import ServiceStatus from './components/serviceStatus.vue';
import UserInfo from './components/userInfo.vue';
import AddonList from './components/addonList.vue';
import SystemResources from './components/systemResources.vue';
import PerformanceMetrics from './components/performanceMetrics.vue';
import EnvironmentInfo from './components/environmentInfo.vue';
</script>

<style scoped lang="scss">
.dashboard-container {
    display: flex;
    gap: 12px;
    overflow: hidden;
    height: 100%;

    .dashboard-left {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow-y: auto;
        min-width: 0;
        background-color: #fff;
        padding: 15px;
    }

    .dashboard-right {
        width: 300px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow-y: auto;
        flex-shrink: 0;
    }

    @media (max-width: 768px) {
        flex-direction: column;
        padding: 10px;
        gap: 10px;

        .dashboard-right {
            width: 100%;
        }
    }
}
</style>
