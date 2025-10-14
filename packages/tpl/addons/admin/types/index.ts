/**
 * Admin 相关的类型定义
 */

// 管理员信息
export interface Admin {
    id: number;
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: 'admin' | 'user';
    status: 0 | 1;
    last_login_time?: string;
    last_login_ip?: string;
    created_at?: string;
    updated_at?: string;
}

// 登录请求
export interface LoginRequest {
    email?: string;
    password?: string;
    phone?: string;
    code?: string;
}

// 登录响应
export interface LoginResponse {
    token: string;
    userInfo: Omit<Admin, 'password'>;
}

// 注册请求
export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
}

// 发送验证码请求
export interface SendSmsCodeRequest {
    phone: string;
}
