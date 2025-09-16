# 响应格式与 RYes/RNo

统一响应结构便于前后端协作与可观测性：

-   成功：`RYes(message, data)` → `{ code:0, msg: message, data }`
-   失败：`RNo(message, error?)` → `{ code:-1, msg: message, error? }`

建议：

-   msg 人类可读，便于日志检索。
-   data 为纯数据对象；错误时可视情况透出 error 简述（避免泄露敏感细节）。
-   文件/流式返回可直接 return 原始 Response，框架将原样透传。
