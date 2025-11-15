<template>
    <div class="auth-container" :class="{ 'sign-up-mode': $Data.isSignUp }">
        <!-- 左侧欢迎区域 -->
        <div class="left-panel">
            <WelcomePanel :is-sign-up="$Data.isSignUp" @toggle="$Method.toggleMode" />
        </div>

        <!-- 右侧表单区域 -->
        <div class="right-panel">
            <!-- 登录表单 -->
            <div class="form-container sign-in-form" :class="{ active: !$Data.isSignUp }">
                <h2 class="form-title">登录到 Befly</h2>

                <!-- 邮箱登录 -->
                <EmailLoginForm />
            </div>

            <!-- 注册表单 -->
            <div class="form-container sign-up-form" :class="{ active: $Data.isSignUp }">
                <h2 class="form-title">注册账号</h2>

                <RegisterForm @success="$Method.handleRegisterSuccess" />
            </div>
        </div>
    </div>
</template>

<script setup>
import { $ref } from 'vue-macros/macros';
import WelcomePanel from './components/welcomePanel.vue';
import EmailLoginForm from './components/emailLoginForm.vue';
import RegisterForm from './components/registerForm.vue';

// 数据定义
const $Data = $ref({
    isSignUp: false
});

// 方法定义
const $Method = {
    // 切换登录/注册模式
    toggleMode() {
        $Data.isSignUp = !$Data.isSignUp;
    },

    // 注册成功后切换到登录模式
    handleRegisterSuccess() {
        $Data.isSignUp = false;
    }
};
</script>

<style scoped lang="scss">
.auth-container {
    display: flex;
    width: 100%;
    min-height: 100vh;
    overflow: hidden;
    position: relative;
    background: #fff;
}

// 青色滑动背景块
.left-panel {
    position: absolute;
    top: 0;
    left: 0;
    width: 50%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #48b19f 0%, #3a9d8f 100%);
    color: #fff;
    z-index: 5;
    transition: transform 0.5s ease-in-out;
}

// 表单区域容器（全屏背景）
.right-panel {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 1;
}

// 注册模式下青色块移动到右侧
.auth-container.sign-up-mode {
    .left-panel {
        transform: translateX(100%);
    }
}

// 表单容器（跟随颜色区域滑动）
.form-container {
    position: absolute;
    width: 50%;
    height: 100%;
    top: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    opacity: 0;
    pointer-events: none;
    transition: all 0.5s ease-in-out;

    &.active {
        opacity: 1;
        pointer-events: all;
    }
}

// 登录模式：登录表单在右侧
.auth-container:not(.sign-up-mode) {
    .sign-in-form {
        right: 0;
    }

    .sign-up-form {
        left: 0;
    }
}

// 注册模式：注册表单在左侧，登录表单在右侧
.auth-container.sign-up-mode {
    .sign-in-form {
        right: -50%;
    }

    .sign-up-form {
        left: 0;
    }
}

.form-title {
    font-size: 1.8rem;
    color: #333;
    margin-bottom: 1.5rem;
    font-weight: 600;
    text-align: center;
    width: 100%;
}

// 响应式设计
@media (max-width: 968px) {
    .auth-container {
        flex-direction: column;
    }

    .left-panel,
    .right-panel {
        flex: none;
        width: 100%;
    }

    .left-panel {
        order: 1 !important;
        position: relative;
        min-height: 200px;
    }

    .right-panel {
        order: 2 !important;
        min-height: 500px;
    }

    .form-container {
        width: 100%;
        padding: 2rem 1rem;
        position: static;
    }

    .auth-container.sign-up-mode {
        .left-panel {
            transform: none;
        }
    }
}

@media (max-width: 576px) {
    .form-title {
        font-size: 1.5rem;
        margin-bottom: 1.5rem;
    }
}
</style>
