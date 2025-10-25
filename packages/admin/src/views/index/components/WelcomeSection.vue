<template>
    <div class="welcome-section">
        <div class="welcome-content">
            <h1 class="welcome-title">欢迎使用 Befly Admin</h1>
            <p class="welcome-desc">强大、灵活、易用的后台管理系统</p>
        </div>
        <div class="welcome-status">
            <div class="status-badge status-online">
                <Icon name="Activity" :size="16" />
                <span>系统运行正常</span>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.welcome-section {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px 24px;
    border-radius: 8px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);

    .welcome-content {
        .welcome-title {
            font-size: 22px;
            font-weight: 600;
            color: white;
            margin: 0 0 4px 0;
        }

        .welcome-desc {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.9);
            margin: 0;
        }
    }

    .welcome-status {
        .status-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 500;

            &.status-online {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                backdrop-filter: blur(10px);
            }
        }
    }
}
</style>
