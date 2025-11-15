<template>
    <div class="section-block">
        <div class="section-content">
            <t-button type="primary" size="large" @click="handleClearCache">
                <template #prefix>
                    <IconLucideRotateCw />
                </template>
                刷新缓存
            </t-button>
        </div>
    </div>
</template>

<script setup>
import IconLucideRotateCw from '~icons/lucide/rotate-cw';
const handleClearCache = () => {
    console.log('刷新缓存');
};
</script>

<style scoped lang="scss">
.section-block {
    .section-content {
        display: flex;
        justify-content: center;
    }
}
</style>
