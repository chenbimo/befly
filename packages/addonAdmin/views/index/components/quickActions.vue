<template>
    <div class="section-block">
        <div class="section-content">
            <TinyButton type="primary" size="large" @click="handleClearCache">
                <template #prefix>
                    <IconLucideRotateCw />
                </template>
                刷新缓存
            </TinyButton>
        </div>
    </div>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router';
import { Button as TinyButton } from '@opentiny/vue';
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
