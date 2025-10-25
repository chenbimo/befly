<template>
    <div class="dashboard-container">
        <WelcomeSection />
        <SystemOverview />
        <ServiceStatus />
        <AddonList />
        <SystemResources />
        <DatabaseAndPerformance />
        <EnvironmentInfo />
        <QuickActions @action-click="handleQuickAction" />
        <OperationLogs />
        <NotificationAndTodo />
    </div>
</template>

<script setup>
import WelcomeSection from './components/WelcomeSection.vue';
import SystemOverview from './components/SystemOverview.vue';
import ServiceStatus from './components/ServiceStatus.vue';
import AddonList from './components/AddonList.vue';
import SystemResources from './components/SystemResources.vue';
import DatabaseAndPerformance from './components/DatabaseAndPerformance.vue';
import EnvironmentInfo from './components/EnvironmentInfo.vue';
import QuickActions from './components/QuickActions.vue';
import OperationLogs from './components/OperationLogs.vue';
import NotificationAndTodo from './components/NotificationAndTodo.vue';

const handleQuickAction = (action) => {
    console.log('执行操作:', action);
};
</script>

<style scoped lang="scss">
.dashboard-container {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    height: 100%;

    @media (max-width: 768px) {
        padding: 10px;
        gap: 10px;
    }
}
</style>
