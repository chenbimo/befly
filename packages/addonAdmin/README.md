# Admin 管理后台插件

## 功能说明

提供管理后台的基础功能,包括:

- 管理员注册
- 管理员登录(支持邮箱和手机号两种方式)
- 发送短信验证码
- 获取用户信息
- 退出登录

## API 接口

所有接口路由前缀: `/api/addon/admin/`

### 1. 注册接口

**路由**: `POST /api/addon/admin/admin/register`

**请求参数**:

```json
{
    "name": "管理员姓名",
    "email": "admin@example.com",
    "password": "密码(至少6位)"
}
```

**响应**:

```json
{
    "code": 0,
    "msg": "注册成功",
    "data": {
        "id": 1,
        "name": "管理员姓名",
        "email": "admin@example.com"
    }
}
```

### 2. 登录接口

**路由**: `POST /api/addon/admin/admin/login`

**邮箱登录**:

```json
{
    "email": "admin@example.com",
    "password": "密码"
}
```

**手机号登录**:

```json
{
    "phone": "13800138000",
    "code": "验证码"
}
```

**响应**:

```json
{
    "code": 0,
    "msg": "登录成功",
    "data": {
        "token": "JWT Token",
        "userInfo": {
            "id": 1,
            "name": "管理员姓名",
            "email": "admin@example.com",
            "role": "admin",
            "status": 1
        }
    }
}
```

### 3. 发送短信验证码

**路由**: `POST /api/addon/admin/admin/sendSmsCode`

**请求参数**:

```json
{
    "phone": "13800138000"
}
```

**响应**:

```json
{
    "code": 0,
    "msg": "验证码已发送",
    "data": {
        "code": "123456" // 仅开发环境返回
    }
}
```

### 4. 获取用户信息

**路由**: `GET /api/addon/admin/admin/userInfo`

**请求头**:

```
Authorization: Bearer {token}
```

**响应**:

```json
{
    "code": 0,
    "msg": "获取成功",
    "data": {
        "id": 1,
        "name": "管理员姓名",
        "email": "admin@example.com",
        "role": "admin",
        "status": 1
    }
}
```

### 5. 退出登录

**路由**: `POST /api/addon/admin/admin/logout`

**请求头**:

```
Authorization: Bearer {token}
```

**响应**:

```json
{
    "code": 0,
    "msg": "退出成功",
    "data": null
}
```

## 数据库表

### admin_admin 表

| 字段            | 类型                 | 说明                |
| --------------- | -------------------- | ------------------- |
| id              | int                  | 主键 ID             |
| name            | varchar(50)          | 姓名                |
| email           | varchar(100)         | 邮箱                |
| phone           | varchar(20)          | 手机号              |
| password        | varchar(255)         | 密码(加密)          |
| role            | enum('admin','user') | 角色                |
| status          | tinyint(1)           | 状态(1-启用 0-禁用) |
| last_login_time | datetime             | 最后登录时间        |
| last_login_ip   | varchar(50)          | 最后登录 IP         |
| created_at      | datetime             | 创建时间            |
| updated_at      | datetime             | 更新时间            |

## 注意事项

1. 短信验证码功能需要配置短信服务提供商
2. 建议在生产环境配置 Redis 来存储验证码和 token 黑名单
3. 密码使用 bcrypt 加密存储
4. Token 有效期默认为 7 天
