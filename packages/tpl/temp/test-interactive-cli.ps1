Write-Host "测试交互式 CLI 菜单" -ForegroundColor Green
Write-Host ""
Write-Host "步骤 1: 启动交互式菜单（输入 bunx befly）" -ForegroundColor Yellow
Write-Host "步骤 2: 看到带数字的脚本列表" -ForegroundColor Yellow
Write-Host "步骤 3: 输入脚本编号（例如: 5 表示选择 admin:syncDev）" -ForegroundColor Yellow
Write-Host "步骤 4: 选择是否添加 --plan 参数" -ForegroundColor Yellow
Write-Host "步骤 5: 确认执行" -ForegroundColor Yellow
Write-Host ""
Write-Host "提示: 输入 0 或直接回车可退出" -ForegroundColor Cyan
Write-Host ""

# 启动交互式菜单
Set-Location "D:\codes\befly\packages\tpl"
bunx befly
