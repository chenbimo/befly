# Token 过期与刷新

-   过期时间由 `Env.JWT_EXPIRES_IN` 控制（如 `30d`）。
-   方案：短期 Access Token + 较长期 Refresh Token；刷新接口验证 refresh 后重新签发 access。
-   注意：刷新接口应进行二次校验（如设备指纹/IP/单端有效）。
