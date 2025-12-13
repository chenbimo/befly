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

                <TForm :model="$Data.formData" :rules="$Data2.formRules" :ref="(el) => ($From.form = el)" class="login-form" :show-message="false" label-width="0">
                    <TFormItem prop="account">
                        <TInputAdornment>
                            <template #prepend>
                                <TSelect v-model="$Data.formData.loginType" :style="{ width: '110px' }" size="large" :popup-props="{ overlayClassName: 'login-type-select-popup' }">
                                    <TOption value="username" label="用户名" />
                                    <TOption value="email" label="邮箱" />
                                    <TOption value="phone" label="手机号" />
                                </TSelect>
                            </template>
                            <TInput v-model="$Data.formData.account" :placeholder="$Data.formData.loginType === 'username' ? '请输入用户名' : $Data.formData.loginType === 'email' ? '请输入邮箱' : '请输入手机号'" size="large" clearable @enter="$Method.apiLogin">
                                <template #prefix-icon>
                                    <ILucideUser />
                                </template>
                            </TInput>
                        </TInputAdornment>
                    </TFormItem>

                    <TFormItem prop="password">
                        <TInput v-model="$Data.formData.password" type="password" placeholder="密码" size="large" clearable @enter="$Method.apiLogin">
                            <template #prefix-icon>
                                <ILucideLock />
                            </template>
                        </TInput>
                    </TFormItem>

                    <div class="form-options">
                        <TCheckbox v-model="$Data.rememberMe">记住我</TCheckbox>
                        <a href="#" class="link-text">忘记密码？</a>
                    </div>

                    <TButton theme="primary" class="login-btn" size="large" block :loading="$Data.loading" @click="$Method.apiLogin"> 登录 </TButton>
                </TForm>

                <div class="login-footer">
                    <p class="copyright">© 2024 Befly. All rights reserved.</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { Form as TForm, FormItem as TFormItem, Input as TInput, Button as TButton, Checkbox as TCheckbox, InputAdornment as TInputAdornment, Select as TSelect, Option as TOption, MessagePlugin } from 'tdesign-vue-next';
import ILucideUser from '~icons/lucide/user';
import ILucideLock from '~icons/lucide/lock';
import { $Http } from '@/plugins/http';
import { $Storage } from '@/plugins/storage';
import { hashPassword } from 'befly-shared/hashPassword';

const router = useRouter();

// 表单引用
const $From = $shallowRef({
    form: null
});

// 数据定义
const $Data = $ref({
    loading: false,
    rememberMe: false,
    formData: {
        loginType: 'username',
        account: '',
        password: ''
    }
});

const $Data2 = $shallowRef({
    formRules: {
        account: [{ required: true, message: '请输入账号', trigger: 'blur' }],
        password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
    }
});

// 方法定义
const $Method = {
    async apiLogin() {
        try {
            const valid = await $From.form.validate();

            $Data.loading = true;

            // 对密码进行 SHA-256 加密
            const hashedPassword = await hashPassword($Data.formData.password);

            const res = await $Http('/addon/admin/auth/login', {
                loginType: $Data.formData.loginType,
                account: $Data.formData.account,
                password: hashedPassword
            });

            // 先保存 token
            $Storage.local.set('token', res.data.token);

            // 如果返回用户信息,也可以存储
            if (res.data.userInfo) {
                $Storage.local.set('userInfo', res.data.userInfo);
            }

            MessagePlugin.success(res.msg || '登录成功');

            // 跳转到首页，路由守卫会自动加载菜单
            await router.push('/');
        } catch (error) {
            console.log('🔥[ error ]-77', error);
        } finally {
            $Data.loading = false;
        }
    }
};
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

.login-form {
    width: 100%;

    :deep(.t-form__item) {
        margin-bottom: 1.25rem;
    }

    :deep(.t-form__controls) {
        width: 100%;
    }

    :deep(.t-input-adornment) {
        width: 100%;
    }

    :deep(.t-input-adornment__prepend) {
        padding: 0;
        border-right: 1px solid var(--login-card-border);
    }

    :deep(.t-input) {
        width: 100%;
        border-radius: 8px;
        transition: all 0.3s;

        &:hover {
            border-color: #667eea;
        }

        &:focus-within {
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
    }

    :deep(.t-input__wrap) {
        width: 100%;
    }
}

.form-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;

    .link-text {
        color: var(--login-link);
        text-decoration: none;
        transition: color 0.3s;

        &:hover {
            color: var(--login-link-hover);
        }
    }
}

.login-btn {
    width: 100%;
    height: 48px;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    background: linear-gradient(135deg, var(--login-btn-gradient-start) 0%, var(--login-btn-gradient-end) 100%);
    border: none;
    transition: all 0.3s;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px var(--login-btn-shadow);
    }

    &:active {
        transform: translateY(0);
    }

    :deep(.t-button__text) {
        color: #fff;
    }
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
