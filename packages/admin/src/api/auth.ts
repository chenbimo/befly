// 登录表单类型
export interface LoginForm {
    email?: string;
    password?: string;
    phone?: string;
    code?: string;
}

// 注册表单类型
export interface RegisterForm {
    name: string;
    email: string;
    password: string;
}

// 登录响应类型
export interface LoginResponse {
    token: string;
    userInfo?: {
        id: number;
        name: string;
        email: string;
        [key: string]: any;
    };
}

/**
 * 用户登录
 */
export const loginApi = (data: LoginForm) => {
    return $Http<LoginResponse>('/admin/login', data);
};

/**
 * 用户注册
 */
export const registerApi = (data: RegisterForm) => {
    return $Http('/admin/register', data);
};

/**
 * 发送短信验证码
 */
export const sendSmsCodeApi = (phone: string) => {
    return $Http('/admin/sendSmsCode', { phone });
};

/**
 * 获取用户信息
 */
export function getUserInfo() {
    return $Http('/admin/adminInfo');
}

/**
 * 退出登录
 */
export const logoutApi = () => {
    return $Http('/admin/logout');
};
