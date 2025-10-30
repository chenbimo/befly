#!/bin/bash

###############################################################################
# PM2 命令别名脚本
# 用于简化 PM2 with Bun 的命令操作
#
# 使用方法：
# 1. 添加到 shell 配置：source /path/to/pm2alias.sh
# 2. 或添加到 ~/.bashrc 或 ~/.zshrc：
#    echo "source /path/to/pm2alias.sh" >> ~/.bashrc
# 3. 重新加载配置：source ~/.bashrc
#
# 注意：需要先安装 bun 和 pm2
###############################################################################

# PM2 基础命令别名（核心别名）
alias pm2='bunx --bun pm2'

# 核心命令别名（保持简短）
alias pm2ls='bunx --bun pm2 ls'                    # 列出进程

# pm2log - 查看日志（智能参数处理）
# 用法：pm2log [app] [其他参数]
# 示例：
#   pm2log                    # 查看所有日志
#   pm2log befly              # 查看 befly 日志
#   pm2log befly --lines 100  # 查看最近 100 行
#   pm2log befly --err        # 查看错误日志
pm2log() {
    if [ -z "$1" ]; then
        # 没有参数，查看所有日志
        bunx --bun pm2 logs
    elif [[ "$1" == -* ]]; then
        # 第一个参数是选项，直接传递
        bunx --bun pm2 logs "$@"
    else
        # 第一个参数是应用名，添加 --name 参数
        local app="$1"
        shift
        bunx --bun pm2 logs --name "$app" "$@"
    fi
}

# PM2 增强函数（参数化）

# pm2start - 智能启动
# 用法：pm2start <app|config>
# 示例：
#   pm2start befly              # 启动应用
#   pm2start pm2.config.cjs     # 启动配置（生产环境）
pm2start() {
    if [ -z "$1" ]; then
        echo "用法: pm2start <app|config>"
        echo "示例:"
        echo "  pm2start befly"
        echo "  pm2start pm2.config.cjs"
        return 1
    fi

    local target="$1"

    # 判断是配置文件还是应用名
    if [[ "$target" == *.js ]] || [[ "$target" == *.cjs ]]; then
        bunx --bun pm2 start "$target"
    else
        bunx --bun pm2 start "$target"
    fi
}

# pm2stop - 停止应用
# 用法：pm2stop <app|all>
pm2stop() {
    if [ -z "$1" ]; then
        echo "用法: pm2stop <app|all>"
        return 1
    fi
    bunx --bun pm2 stop "$1"
}

# pm2restart - 重启应用
# 用法：pm2restart <app|config|all>
pm2restart() {
    if [ -z "$1" ]; then
        echo "用法: pm2restart <app|config|all>"
        return 1
    fi

    bunx --bun pm2 restart "$1"
}

# pm2reload - 重载应用（零停机）
# 用法：pm2reload <app|all>
pm2reload() {
    if [ -z "$1" ]; then
        echo "用法: pm2reload <app|all>"
        return 1
    fi
    bunx --bun pm2 reload "$1"
}

# pm2del - 删除应用
# 用法：pm2del <app|all>
pm2del() {
    if [ -z "$1" ]; then
        echo "用法: pm2del <app|all>"
        return 1
    fi
    bunx --bun pm2 delete "$1"
}

# pm2scale - 扩展实例
# 用法：pm2scale <app> <num>
pm2scale() {
    if [ -z "$1" ] || [ -z "$2" ]; then
        echo "用法: pm2scale <app> <num>"
        echo "示例: pm2scale befly 4"
        return 1
    fi
    bunx --bun pm2 scale "$1" "$2"
}

# pm2show - 查看详情
# 用法：pm2show <app>
pm2show() {
    if [ -z "$1" ]; then
        echo "用法: pm2show <app>"
        return 1
    fi
    bunx --bun pm2 show "$1"
}

# pm2flush - 清空日志
# 用法：pm2flush [app]
pm2flush() {
    if [ -z "$1" ]; then
        bunx --bun pm2 flush
    else
        bunx --bun pm2 flush "$1"
    fi
}

# pm2mon - 实时监控
alias pm2mon='bunx --bun pm2 monit'

# pm2save - 保存进程列表
alias pm2save='bunx --bun pm2 save'

# pm2kill - 杀死 PM2 守护进程
alias pm2kill='bunx --bun pm2 kill'

# 高级部署函数

# pm2deploy - 完整部署
# 用法：pm2deploy [config]
pm2deploy() {
    local config="${1:-pm2.config.cjs}"

    if [ ! -f "$config" ]; then
        echo "错误: 配置文件 '$config' 不存在"
        return 1
    fi

    echo "========================================="
    echo "PM2 部署"
    echo "========================================="

    bunx --bun pm2 stop "$config" 2>/dev/null || echo "跳过停止..."
    bunx --bun pm2 delete "$config" 2>/dev/null || echo "跳过删除..."
    bunx --bun pm2 start "$config"
    bunx --bun pm2 save
    bunx --bun pm2 ls

    echo "========================================="
    echo "部署完成！"
    echo "========================================="
}

# pm2redeploy - 零停机重新部署
# 用法：pm2redeploy [config]
pm2redeploy() {
    local config="${1:-pm2.config.cjs}"

    if [ ! -f "$config" ]; then
        echo "错误: 配置文件 '$config' 不存在"
        return 1
    fi

    echo "零停机重新部署"
    bunx --bun pm2 reload "$config"
    bunx --bun pm2 save
}

# pm2clean - 完全清理
pm2clean() {
    echo "警告: 即将完全清理 PM2"
    read -p "确定要继续吗？(yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "操作已取消"
        return 0
    fi

    bunx --bun pm2 stop all 2>/dev/null || true
    bunx --bun pm2 delete all 2>/dev/null || true
    bunx --bun pm2 flush 2>/dev/null || true
    bunx --bun pm2 kill
    echo "清理完成！"
}

# 显示帮助
pm2help() {
    cat << 'EOF'
========================================
PM2 命令别名帮助
========================================

核心命令:
  pm2              - PM2 基础命令
  pm2ls            - 列出所有进程
  pm2log           - 查看日志（支持原生参数）
  pm2mon           - 实时监控

进程管理:
  pm2start <app|config>        - 启动应用/配置
  pm2stop <app|all>            - 停止应用
  pm2restart <app|all>         - 重启应用
  pm2reload <app|all>          - 重载应用（零停机）
  pm2del <app|all>             - 删除应用
  pm2scale <app> <num>         - 扩展实例
  pm2show <app>                - 查看详情

日志管理:
  pm2log                       - 查看所有日志
  pm2log <app>                 - 查看特定应用日志
  pm2log --lines 100           - 查看最近 100 行
  pm2log <app> --err           - 查看错误日志
  pm2flush [app]               - 清空日志

部署操作:
  pm2deploy [config]           - 完整部署（默认 pm2.config.cjs）
  pm2redeploy [config]         - 零停机重新部署

系统管理:
  pm2save                      - 保存进程列表
  pm2kill                      - 杀死 PM2 守护进程
  pm2clean                     - 完全清理（交互式）
  pm2 startup                  - 开机自启动
  pm2 resurrect                - 恢复进程

常用示例:
  # 启动应用
  pm2start befly
  pm2start pm2.config.cjs

  # 查看日志
  pm2log                       # 所有日志
  pm2log befly                 # befly 日志
  pm2log befly --lines 100     # 最近 100 行
  pm2log befly --err           # 错误日志

  # 进程控制
  pm2stop befly                # 停止
  pm2restart befly             # 重启
  pm2reload befly              # 重载（零停机）
  pm2del befly                 # 删除
  pm2scale befly 4             # 扩展到 4 个实例

  # 部署
  pm2deploy                    # 完整部署
  pm2redeploy                  # 零停机重新部署

  # 查看
  pm2ls                        # 列表
  pm2show befly                # 详情
  pm2mon                       # 监控

========================================
提示: pm2log 支持所有 PM2 原生日志参数
========================================
EOF
}

# 打印加载成功信息
echo "✅ PM2 别名已加载！输入 'pm2help' 查看所有可用命令"
