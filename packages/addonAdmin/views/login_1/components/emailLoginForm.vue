<template>
    <TForm :model="$Data.formData" :rules="$Data2.formRules" :ref="(el) => ($From.form = el)" class="login-form" :show-message="false" label-width="0">
        <TFormItem prop="account">
            <TInput v-model="$Data.formData.account" placeholder="用户名或邮箱" size="large" clearable @enter="$Method.apiLogin">
                <template #prefix-icon>
                    <ILucideUser />
                </template>
            </TInput>
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
</template>

<script setup>
import { useRouter } from 'vue-router';
import { Form as TForm, FormItem as TFormItem, Input as TInput, Button as TButton, Checkbox as TCheckbox, MessagePlugin } from 'tdesign-vue-next';
import ILucideUser from '~icons/lucide/user';
import ILucideLock from '~icons/lucide/lock';
import { $Http } from '@/plugins/http';
import { $Storage } from '@/plugins/storage';

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
        account: '',
        password: ''
    }
});

const $Data2 = $shallowRef({
    formRules: {
        account: [{ required: true, message: '请输入用户名或邮箱', trigger: 'blur' }],
        password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
    }
});

// 方法定义
const $Method = {
    async apiLogin() {
        try {
            const valid = await $From.form.validate();

            $Data.loading = true;

            const res = await $Http('/addon/admin/auth/login', {
                account: $Data.formData.account,
                password: $Data.formData.password
            });

            // 先保存 token
            $Storage.local.set('token', res.data.token);

            // 如果返回用户信息,也可以存储
            if (res.data.userInfo) {
                $Storage.local.set('userInfo', res.data.userInfo);
            }

            MessagePlugin.info({
                message: '登录成功',
                status: 'success'
            });

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
.login-form {
    width: 100%;

    :deep(.t-form__item) {
        margin-bottom: 1.25rem;
    }

    :deep(.t-form__controls) {
        width: 100%;
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
</style>
