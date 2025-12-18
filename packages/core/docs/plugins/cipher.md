# Cipher 加密工具

> 哈希、签名、密码加密与 JWT 令牌

## 目录

- [概述](#概述)
- [Cipher 加密类](#cipher-加密类)
- [JWT 令牌](#jwt-令牌)
- [插件集成](#插件集成)
- [FAQ](#faq)

---

## 概述

Befly 提供两个安全相关的工具：

| 工具     | 说明       | 典型场景                 |
| -------- | ---------- | ------------------------ |
| `Cipher` | 加密工具类 | 数据哈希、签名、密码加密 |
| `Jwt`    | JWT 令牌类 | 用户认证、API 授权       |

---

## Cipher 加密类

`Cipher` 提供：

- 哈希：`md5/sha1/sha256/sha384/sha512/blake2b*`
- HMAC：`hmacSha256` 等
- 密码：`hashPassword`（bcrypt）与 `verifyPassword`
- 辅助：Base64、随机串、文件哈希、fastHash

---

## JWT 令牌

`Jwt` 用于签发与验证 JWT：

- `sign(payload, options?)`
- `verify(token, options?)`
- `decode(token, full?)`

JWT 插件会读取配置文件中的 `auth` 配置（如 secret / expiresIn / algorithm）。

---

## 插件集成

在 API handler 中一般直接使用：

- `befly.cipher.*`
- `befly.jwt.*`

---

## FAQ

- 密码存储应使用 `hashPassword`（bcrypt），不要用 MD5/SHA\* 直接存密码。
- 生产环境必须替换 `auth.secret` 为强随机字符串。
