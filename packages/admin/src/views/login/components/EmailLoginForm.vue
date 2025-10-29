<template>
    <tiny-form :data="$Data.formData" :rules="$Data.rules" :ref="(el) => ($Form.form = el)" class="login-form" :required-mark="false" show-error-message label-align="left" label-width="70px">
        <tiny-form-item name="email" label="邮箱">
            <tiny-input v-model="$Data.formData.email" placeholder="请输入邮箱" size="large" clearable>
                <template #prefix-icon>
                    <Icon name="Mail" :size="18" />
                </template>
            </tiny-input>
        </tiny-form-item>

        <tiny-form-item name="password" label="密码">
            <tiny-input v-model="$Data.formData.password" type="password" placeholder="请输入密码" size="large" clearable>
                <template #prefix-icon>
                    <Icon name="Lock" :size="18" />
                </template>
            </tiny-input>
        </tiny-form-item>

        <div class="form-footer">
            <a href="#" class="forgot-password">忘记密码？</a>
        </div>

        <tiny-button theme="primary" class="auth-btn" size="large" :loading="$Data.loading" @click="$Method.handleSubmit"> 登录 </tiny-button>
    </tiny-form>
</template>

<script setup>
const router = useRouter();

// 表单引用
const $Form = $ref({
    form: null
});

// 数据定义
const $Data = $ref({
    loading: false,
    formData: {
        email: '',
        password: ''
    },
    rules: {
        email: [{ required: true, message: '请输入邮箱', type: 'error' }],
        password: [{ required: true, message: '请输入密码', type: 'error' }]
    }
});

// 方法定义
const $Method = {
    async handleSubmit() {
        const valid = await $Form.form.validate();
        if (!valid) return;

        $Data.loading = true;

        try {
            const res = await $Http('/core/admin/login', $Data.formData);

            // 先保存 token
            localStorage.setItem('token', res.data.token);

            // 如果返回用户信息,也可以存储
            if (res.data.userInfo) {
                localStorage.setItem('userInfo', JSON.stringify(res.data.userInfo));
            }

            MessagePlugin.success('登录成功');

            // 跳转到首页，路由守卫会自动加载菜单
            await router.push('/');
        } catch (error) {
            // 错误已经在 request 拦截器中处理
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
