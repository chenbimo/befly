# befly-vite

Befly Vite 配置预设和插件集合，专为 Vue 3 项目优化。

## 特性

- ✅ 开箱即用的 Vite + Vue 3 配置
- ✅ 集成常用插件（路由、自动导入、图标、UnoCSS 等）
- ✅ 优化的构建配置（分包、压缩、分析）
- ✅ 支持自定义扩展

## 安装

```bash
bun add -d befly-vite vite
```

## 使用

### 基础用法

```javascript
// vite.config.js
import { createBeflyViteConfig } from "befly-vite";

export default createBeflyViteConfig();
```

### 自定义配置

```javascript
import { createBeflyViteConfig } from "befly-vite";
import { fileURLToPath } from "node:url";

export default createBeflyViteConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),

    // 自定义配置
    userConfig: {
        server: {
            port: 5600
        }
    }
});
```

## License

Apache-2.0
