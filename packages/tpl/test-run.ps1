# 测试运行脚本
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$env:NODE_ENV = 'development'
bun main.ts
