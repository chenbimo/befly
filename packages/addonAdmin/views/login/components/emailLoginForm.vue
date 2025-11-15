<template>
    <TinyForm :model="$Data.formData" :rules="$Data2.formRules" :ref="(el) => ($From.form = el)" class="login-form" label-width="90px" label-position="left" :show-message="false">
        <TinyFormItem prop="account" label="账号">
            <TinyInput v-model="$Data.formData.account" placeholder="请输入用户名或邮箱" size="large" clearable>
                <template #prefix-icon>
                    <IconLucideUser />
                </template>
            </TinyInput>
        </TinyFormItem>

        <TinyFormItem prop="password" label="密码">
            <TinyInput v-model="$Data.formData.password" type="password" placeholder="请输入密码" size="large" clearable>
                <template #prefix-icon>
                    <IconLucideLock />
                </template>
            </TinyInput>
        </TinyFormItem>

        <div class="form-footer">
            <a href="#" class="forgot-password">忘记密码？</a>
        </div>

        <TinyButton theme="primary" class="auth-btn" size="large" :loading="$Data.loading" @click="$Method.apiLogin"> 登录 </TinyButton>
    </TinyForm>
</template>

<script setup>
import { $ref, $shallowRef } from 'vue-macros/macros';
import { useRouter, useRoute } from 'vue-router';
import { Button as TinyButton, Form as TinyForm, FormItem as TinyFormItem, Input as TinyInput, Modal } from '@opentiny/vue';
import IconLucideUser from '~icons/lucide/user';
import IconLucideLock from '~icons/lucide/lock';
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

            Modal.message({
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
    max-width: 450px;
}

.tiny-form-item {
    width: 100%;
    margin-bottom: 1.2rem;

    :deep(.tiny-form__controls) {
        width: 100%;
    }

    :deep(.tiny-input) {
        width: 100%;
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        transition: all 0.3s;

        &:hover {
            border-color: #48b19f;
        }

        &:focus-within {
            border-color: #48b19f;
            background: #fff;
        }

        input {
            padding: 0.75rem 1rem;
        }
    }
}

.form-footer {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
}

.forgot-password {
    font-size: 0.8rem;
    color: #888;
    text-decoration: none;

    &:hover {
        color: #48b19f;
    }
}

.auth-btn {
    width: 100% !important;
    max-width: 100%;
    height: 44px;
    border-radius: 6px;
    background: #48b19f;
    border: none;
    font-size: 0.95rem;
    font-weight: 600;
    margin-top: 0.5rem;
    transition: all 0.3s;

    &:hover {
        background: #3a9d8f;
        transform: translateY(-1px);
        box-shadow: 0 3px 10px rgba(72, 177, 159, 0.3);
    }

    :deep(.tiny-button__text) {
        color: #fff;
    }
}
</style>
