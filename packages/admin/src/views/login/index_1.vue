<template>
    <div class="auth-container" :class="{ 'sign-up-mode': $Data.isSignUp }">
        <!-- 左侧欢迎区域 -->
        <div class="left-panel">
            <div class="panel-content" v-if="!$Data.isSignUp">
                <h2>你好，朋友！</h2>
                <p>填写个人信息，开始使用</p>
                <button class="toggle-btn" @click="$Method.toggleMode">注册账号</button>
            </div>
            <div class="panel-content" v-else>
                <h2>欢迎回来！</h2>
                <p>使用您的账号登录</p>
                <button class="toggle-btn" @click="$Method.toggleMode">立即登录</button>
            </div>
        </div>

        <!-- 右侧表单区域 -->
        <div class="right-panel">
            <!-- 登录表单 -->
            <div class="form-container sign-in-form" :class="{ active: !$Data.isSignUp }">
                <h2 class="form-title">登录到 Befly</h2>

                <!-- 登录方式切换 -->
                <div class="login-type-tabs">
                    <button type="button" class="tab-btn" :class="{ active: $Data.loginType === 'email' }" @click="$Method.switchLoginType('email')">邮箱登录</button>
                    <button type="button" class="tab-btn" :class="{ active: $Data.loginType === 'phone' }" @click="$Method.switchLoginType('phone')">手机登录</button>
                    <button type="button" class="tab-btn" :class="{ active: $Data.loginType === 'qrcode' }" @click="$Method.switchLoginType('qrcode')">扫码登录</button>
                </div>

                <!-- 邮箱登录 -->
                <t-form v-if="$Data.loginType === 'email'" :data="$Data.loginForm.email" :rules="$Data.loginRules.email" :ref="(el: any) => ($Form.emailForm = el)" @submit="$Method.handleLogin" class="login-form" :required-mark="false" show-error-message label-align="left" label-width="70px">
                    <t-form-item name="email" label="邮箱">
                        <t-input v-model="$Data.loginForm.email.email" placeholder="请输入邮箱" size="large" clearable>
                            <template #prefix-icon>
                                <mail-icon />
                            </template>
                        </t-input>
                    </t-form-item>

                    <t-form-item name="password" label="密码">
                        <t-input v-model="$Data.loginForm.email.password" type="password" placeholder="请输入密码" size="large" clearable>
                            <template #prefix-icon>
                                <lock-on-icon />
                            </template>
                        </t-input>
                    </t-form-item>

                    <div class="form-footer">
                        <a href="#" class="forgot-password">忘记密码？</a>
                    </div>

                    <t-button theme="primary" type="submit" class="auth-btn" size="large" :loading="$Data.loginLoading"> 登录 </t-button>
                </t-form>

                <!-- 手机登录 -->
                <t-form v-if="$Data.loginType === 'phone'" :data="$Data.loginForm.phone" :rules="$Data.loginRules.phone" :ref="(el: any) => ($Form.phoneForm = el)" @submit="$Method.handleLogin" class="login-form" :required-mark="false" show-error-message label-align="left" label-width="70px">
                    <t-form-item name="phone" label="手机号">
                        <t-input v-model="$Data.loginForm.phone.phone" placeholder="请输入手机号" size="large" clearable>
                            <template #prefix-icon>
                                <mobile-icon />
                            </template>
                        </t-input>
                    </t-form-item>

                    <t-form-item name="code" label="验证码">
                        <t-input v-model="$Data.loginForm.phone.code" placeholder="请输入验证码" size="large" clearable>
                            <template #prefix-icon>
                                <secured-icon />
                            </template>
                            <template #suffix>
                                <t-button variant="text" :disabled="$Data.codeCountdown > 0" @click="$Method.sendCode">
                                    {{ $Data.codeCountdown > 0 ? `${$Data.codeCountdown}秒后重试` : '发送验证码' }}
                                </t-button>
                            </template>
                        </t-input>
                    </t-form-item>

                    <t-button theme="primary" type="submit" class="auth-btn" size="large" :loading="$Data.loginLoading"> 登录 </t-button>
                </t-form>

                <!-- 扫码登录 -->
                <div v-if="$Data.loginType === 'qrcode'" class="qrcode-container">
                    <div class="qrcode-box">
                        <t-qrcode :value="$Data.qrcodeValue" :size="200" :status="$Data.qrcodeStatus" @refresh="$Method.refreshQrcode" />
                        <p class="qrcode-tip">{{ $Data.qrcodeTip }}</p>
                    </div>
                </div>
            </div>

            <!-- 注册表单 -->
            <div class="form-container sign-up-form" :class="{ active: $Data.isSignUp }">
                <h2 class="form-title">注册账号</h2>

                <t-form :data="$Data.registerForm" :rules="$Data.registerRules" :ref="(el: any) => ($Form.registerForm = el)" @submit="$Method.handleRegister" class="login-form" :required-mark="false" show-error-message label-align="left" label-width="70px">
                    <t-form-item name="name" label="姓名">
                        <t-input v-model="$Data.registerForm.name" placeholder="请输入姓名" size="large" clearable>
                            <template #prefix-icon>
                                <user-icon />
                            </template>
                        </t-input>
                    </t-form-item>

                    <t-form-item name="email" label="邮箱">
                        <t-input v-model="$Data.registerForm.email" placeholder="请输入邮箱" size="large" clearable>
                            <template #prefix-icon>
                                <mail-icon />
                            </template>
                        </t-input>
                    </t-form-item>

                    <t-form-item name="password" label="密码">
                        <t-input v-model="$Data.registerForm.password" type="password" placeholder="请输入密码" size="large" clearable>
                            <template #prefix-icon>
                                <lock-on-icon />
                            </template>
                        </t-input>
                    </t-form-item>

                    <t-button theme="primary" type="submit" class="auth-btn" size="large" :loading="$Data.registerLoading"> 注册 </t-button>
                </t-form>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
const router = useRouter();

// 表单引用定义
const $Form = $ref({
    emailForm: null as any,
    phoneForm: null as any,
    registerForm: null as any
});

// 数据定义
const $Data = $ref({
    loginLoading: false,
    registerLoading: false,
    isSignUp: false,
    loginType: 'email' as 'email' | 'phone' | 'qrcode',
    codeCountdown: 0,
    qrcodeValue: '',
    qrcodeStatus: 'loading' as 'active' | 'expired' | 'loading' | 'scanned',
    qrcodeTip: '二维码加载中...',
    loginForm: {
        email: {
            email: '',
            password: ''
        },
        phone: {
            phone: '',
            code: ''
        }
    },
    loginRules: {
        email: {
            email: [{ required: true, message: '请输入邮箱', type: 'error' }],
            password: [{ required: true, message: '请输入密码', type: 'error' }]
        },
        phone: {
            phone: [{ required: true, message: '请输入手机号', type: 'error' }],
            code: [{ required: true, message: '请输入验证码', type: 'error' }]
        }
    },
    registerForm: {
        name: '',
        email: '',
        password: ''
    },
    registerRules: {
        name: [{ required: true, message: '请输入姓名', type: 'error' }],
        email: [{ required: true, message: '请输入邮箱', type: 'error' }],
        password: [{ required: true, message: '请输入密码', type: 'error' }]
    }
});

// 方法定义
const $Method = {
    // 切换登录/注册模式
    toggleMode() {
        $Data.isSignUp = !$Data.isSignUp;
    },

    // 切换登录方式
    switchLoginType(type: 'email' | 'phone' | 'qrcode') {
        $Data.loginType = type;
        // 如果切换到二维码登录，生成二维码
        if (type === 'qrcode') {
            $Method.generateQrcode();
        }
    },

    // 生成二维码
    generateQrcode() {
        $Data.qrcodeStatus = 'loading';
        $Data.qrcodeTip = '二维码加载中...';

        // TODO: 调用生成二维码接口
        // const res = await generateQrcodeApi();

        // 模拟生成二维码
        setTimeout(() => {
            // 生成一个唯一的二维码标识
            const qrcodeId = `qrcode_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            $Data.qrcodeValue = `https://befly.com/qrcode/scan?id=${qrcodeId}`;
            $Data.qrcodeStatus = 'active';
            $Data.qrcodeTip = '请使用手机扫描二维码登录';

            // 开始轮询检查扫码状态
            $Method.checkQrcodeStatus();
        }, 1000);
    },

    // 刷新二维码
    refreshQrcode() {
        $Method.generateQrcode();
    },

    // 检查二维码状态
    checkQrcodeStatus() {
        // TODO: 实现轮询检查二维码扫描状态
        // 这里模拟扫码状态变化
        setTimeout(() => {
            // 模拟扫码成功
            // $Data.qrcodeStatus = 'scanned';
            // $Data.qrcodeTip = '扫描成功，请在手机上确认登录';
            // 模拟登录成功
            // setTimeout(() => {
            //     localStorage.setItem('token', 'mock-token');
            //     MessagePlugin.success('登录成功');
            //     router.push('/dashboard');
            // }, 2000);
        }, 5000);

        // 模拟二维码过期
        setTimeout(() => {
            if ($Data.qrcodeStatus === 'active') {
                $Data.qrcodeStatus = 'expired';
                $Data.qrcodeTip = '二维码已过期，请点击刷新';
            }
        }, 30000); // 30秒后过期
    },

    // 发送验证码
    async sendCode() {
        if (!$Data.loginForm.phone.phone) {
            MessagePlugin.warning('请先输入手机号');
            return;
        }

        try {
            await $Http.post('/admin/sendSmsCode', { phone: $Data.loginForm.phone.phone });

            MessagePlugin.success('验证码已发送');
            $Data.codeCountdown = 60;

            const timer = setInterval(() => {
                $Data.codeCountdown--;
                if ($Data.codeCountdown <= 0) {
                    clearInterval(timer);
                }
            }, 1000);
        } catch (error) {
            // 错误已经在 request 拦截器中处理
        }
    },

    // 处理登录
    async handleLogin() {
        let valid = false;
        let formData = null;

        if ($Data.loginType === 'email') {
            valid = await $Form.emailForm.validate();
            formData = $Data.loginForm.email;
        } else if ($Data.loginType === 'phone') {
            valid = await $Form.phoneForm.validate();
            formData = $Data.loginForm.phone;
        }

        if (!valid) return;

        $Data.loginLoading = true;

        try {
            const res = await $Http.post('/admin/login', formData);
            localStorage.setItem('token', res.data.token);

            // 如果返回用户信息,也可以存储
            if (res.data.userInfo) {
                localStorage.setItem('userInfo', JSON.stringify(res.data.userInfo));
            }

            MessagePlugin.success('登录成功');
            router.push('/');
        } catch (error) {
            // 错误已经在 request 拦截器中处理
        } finally {
            $Data.loginLoading = false;
        }
    },

    // 处理注册
    async handleRegister() {
        const valid = await $Form.registerForm.validate();
        if (!valid) return;

        $Data.registerLoading = true;

        try {
            await $Http.post('/admin/register', $Data.registerForm);
            MessagePlugin.success('注册成功，请登录');
            $Data.isSignUp = false;

            // 清空注册表单
            $Data.registerForm.name = '';
            $Data.registerForm.email = '';
            $Data.registerForm.password = '';
        } catch (error) {
            // 错误已经在 request 拦截器中处理
        } finally {
            $Data.registerLoading = false;
        }
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
}

// 淡入动画
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
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

// 登录方式切换标签
.login-type-tabs {
    display: flex;
    justify-content: center;
    gap: 0;
    margin-bottom: 2rem;
    border-bottom: 2px solid #f0f0f0;
    width: 100%;
    max-width: 450px;

    .tab-btn {
        padding: 0.75rem 1.2rem;
        border: none;
        background: transparent;
        color: #666;
        font-size: 0.875rem;
        cursor: pointer;
        position: relative;
        transition: all 0.3s;

        &::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 100%;
            height: 2px;
            background: #48b19f;
            transform: scaleX(0);
            transition: transform 0.3s;
        }

        &.active {
            color: #48b19f;
            font-weight: 600;

            &::after {
                transform: scaleX(1);
            }
        }

        &:hover {
            color: #48b19f;
        }
    }
}

.login-form {
    width: 100%;
    max-width: 450px;
}

.t-form-item {
    width: 100%;
    margin-bottom: 1.2rem;

    :deep(.t-form__controls) {
        width: 100%;
    }

    :deep(.t-input) {
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

    :deep(.t-button__text) {
        color: #fff;
    }
}

// 二维码容器
.qrcode-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 350px;
    padding: 2rem 0;
    width: 100%;
    max-width: 450px;
}

.qrcode-box {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;

    :deep(.t-qrcode) {
        margin: 0 auto;
    }

    .qrcode-tip {
        font-size: 0.9rem;
        color: #666;
        margin-top: 0.5rem;
    }
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
        min-height: 200px;

        .panel-content {
            h2 {
                font-size: 1.5rem;
            }

            p {
                font-size: 0.9rem;
            }
        }
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
}

@media (max-width: 576px) {
    .left-panel .panel-content {
        padding: 1.5rem;

        h2 {
            font-size: 1.3rem;
        }

        p {
            font-size: 0.85rem;
            margin-bottom: 1rem;
        }
    }

    .form-title {
        font-size: 1.5rem;
        margin-bottom: 1.5rem;
    }

    .login-type-tabs {
        gap: 0.2rem;

        .tab-btn {
            padding: 0.6rem 1rem;
            font-size: 0.8rem;
        }
    }
}
</style>
