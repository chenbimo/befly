<template>
    <div class="login-container">
        <!-- 左侧装饰区域 -->
        <div class="left-section">
            <div class="bg-decoration">
                <div class="circle circle-1"></div>
                <div class="circle circle-2"></div>
                <div class="circle circle-3"></div>
            </div>
            <div class="welcome-content">
                <h1 class="brand-title">Befly</h1>
                <p class="brand-subtitle">轻量级业务快速开发框架</p>
            </div>
        </div>

        <!-- 右侧登录区域 -->
        <div class="right-section">
            <div class="login-box">
                <div class="login-header">
                    <h2 class="login-title">欢迎回来</h2>
                    <p class="login-subtitle">请登录您的账户</p>
                </div>

                <EmailLoginForm />

                <div class="login-footer">
                    <p class="copyright">© 2024 Befly. All rights reserved.</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import EmailLoginForm from './components/emailLoginForm.vue';
</script>

<style scoped lang="scss">
.login-container {
    display: flex;
    width: 100%;
    min-height: 100vh;
    background: var(--login-bg);
}

// 左侧装饰区域
.left-section {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--login-left-gradient-start) 0%, var(--login-left-gradient-end) 100%);
    overflow: hidden;
}

.bg-decoration {
    position: absolute;
    width: 100%;
    height: 100%;
    overflow: hidden;

    .circle {
        position: absolute;
        border-radius: 50%;
        background: var(--login-circle-bg);
        animation: float 20s infinite ease-in-out;

        &.circle-1 {
            width: 400px;
            height: 400px;
            top: -100px;
            left: -100px;
            animation-delay: 0s;
        }

        &.circle-2 {
            width: 300px;
            height: 300px;
            bottom: -50px;
            right: -50px;
            animation-delay: 7s;
        }

        &.circle-3 {
            width: 200px;
            height: 200px;
            top: 50%;
            right: 10%;
            animation-delay: 14s;
        }
    }
}

@keyframes float {
    0%,
    100% {
        transform: translateY(0) scale(1);
    }
    50% {
        transform: translateY(-20px) scale(1.05);
    }
}

.welcome-content {
    position: relative;
    z-index: 1;
    color: #fff;
    text-align: center;
    padding: 2rem;
}

.brand-title {
    font-size: 4rem;
    font-weight: 700;
    margin-bottom: 1rem;
    letter-spacing: 2px;
    color: var(--login-brand-title);
}

.brand-subtitle {
    font-size: 1.25rem;
    margin-bottom: 3rem;
    color: var(--login-brand-subtitle);
}

// 右侧登录区域
.right-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
}

.login-box {
    width: 100%;
    max-width: 440px;
    background: var(--login-card-bg);
    border: 1px solid var(--login-card-border);
    border-radius: 16px;
    box-shadow: 0 10px 40px var(--login-card-shadow);
    padding: 3rem 2.5rem;
}

.login-header {
    text-align: center;
    margin-bottom: 2.5rem;
}

.login-title {
    font-size: 2rem;
    font-weight: 600;
    color: var(--login-title);
    margin-bottom: 0.5rem;
}

.login-subtitle {
    font-size: 1rem;
    color: var(--login-subtitle);
}

.login-footer {
    margin-top: 2rem;
    text-align: center;
}

.copyright {
    font-size: 0.875rem;
    color: var(--login-subtitle);
}

// 响应式设计
@media (max-width: 1024px) {
    .login-container {
        flex-direction: column;
    }

    .left-section {
        min-height: 300px;
        flex: none;
    }

    .brand-title {
        font-size: 3rem;
    }

    .right-section {
        flex: 1;
    }
}

@media (max-width: 768px) {
    .left-section {
        min-height: 200px;
    }

    .brand-title {
        font-size: 2.5rem;
    }

    .brand-subtitle {
        font-size: 1rem;
        margin-bottom: 2rem;
    }

    .login-box {
        padding: 2rem 1.5rem;
    }

    .login-title {
        font-size: 1.75rem;
    }
}

@media (max-width: 480px) {
    .right-section {
        padding: 1rem;
    }

    .login-box {
        padding: 1.5rem 1rem;
        border-radius: 12px;
    }
}
</style>
