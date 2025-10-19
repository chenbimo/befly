<template>
    <component :is="iconComponent" :size="size" :color="color" :stroke-width="strokeWidth" v-bind="$attrs" />
</template>

<script setup lang="ts">
import * as LucideIcons from 'lucide-vue-next';
import { computed, markRaw } from 'vue';

interface Props {
    name: string;
    size?: number;
    color?: string;
    strokeWidth?: number;
}

const props = withDefaults(defineProps<Props>(), {
    size: 16,
    strokeWidth: 2
});

// 动态获取图标组件
const iconComponent = computed(() => {
    const iconName = props.name as keyof typeof LucideIcons;
    const icon = LucideIcons[iconName];

    if (!icon) {
        console.warn(`Icon "${props.name}" not found in lucide-vue-next`);
        return null;
    }

    // 使用 markRaw 避免响应式包装
    return markRaw(icon);
});
</script>
