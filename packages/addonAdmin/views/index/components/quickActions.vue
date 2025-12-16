<template>
    <div class="section-block">
        <div class="section-content">
            <TButton theme="primary" size="large" @click="handleClearCache">
                <template #prefix>
                    <ILucideRotateCw />
                </template>
                刷新缓存
            </TButton>
        </div>
    </div>
</template>

<script setup>
import { Button as TButton } from "tdesign-vue-next";
import ILucideRotateCw from "~icons/lucide/rotate-cw";

const handleClearCache = () => {
    // TODO: 接入刷新缓存接口
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
