<template>
    <div class="panel-content" v-if="!isSignUp">
        <h2>你好，朋友！</h2>
        <p>填写个人信息，开始使用</p>
        <button class="toggle-btn" @click="$emit('toggle')">注册账号</button>
    </div>
    <div class="panel-content" v-else>
        <h2>欢迎回来！</h2>
        <p>使用您的账号登录</p>
        <button class="toggle-btn" @click="$emit('toggle')">立即登录</button>
    </div>
</template>

<script setup>
const props = defineProps({
    isSignUp: {
        type: Boolean,
        default: false
    }
});

defineEmits(['toggle']);
</script>

<style scoped lang="scss">
.panel-content {
    text-align: center;
    padding: 2rem;
    max-width: 400px;

    h2 {
        font-size: 2rem;
        font-weight: 600;
        margin-bottom: 1rem;
    }

    p {
        font-size: 1rem;
        line-height: 1.6;
        margin-bottom: 2rem;
        opacity: 0.9;
    }

    .toggle-btn {
        padding: 0.8rem 3rem;
        border: 2px solid #fff;
        background: transparent;
        color: #fff;
        border-radius: 25px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
            background: #fff;
            color: #48b19f;
        }
    }
}
</style>
