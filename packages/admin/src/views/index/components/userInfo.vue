<template>
    <div class="section-block user-info-card">
        <div class="user-header">
            <div class="user-avatar">
                <Icon name="User" :size="32" />
            </div>
            <div class="user-basic">
                <div class="user-name">{{ userInfo.nickname || userInfo.name || userInfo.username || '未设置' }}</div>
                <div class="user-role">{{ userInfo.role?.name || '普通用户' }}</div>
            </div>
        </div>
        <div class="user-details">
            <div class="detail-item">
                <Icon name="Mail" :size="14" />
                <span>{{ userInfo.email || '未设置' }}</span>
            </div>
            <div v-if="userInfo.phone" class="detail-item">
                <Icon name="Phone" :size="14" />
                <span>{{ userInfo.phone }}</span>
            </div>
            <div v-if="userInfo.lastLoginTime" class="detail-item">
                <Icon name="Clock" :size="14" />
                <span>{{ formatTime(userInfo.lastLoginTime) }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
// 组件内部数据
const userInfo = $ref({});

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http('/core/info');
        Object.assign(userInfo, data);
    } catch (error) {
        console.error('获取用户信息失败:', error);
    }
};

// 格式化时间
const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(Number(timestamp));
    const now = new Date();
    const diff = now - date;

    // 小于1分钟
    if (diff < 60000) {
        return '刚刚';
    }
    // 小于1小时
    if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`;
    }
    // 小于24小时
    if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`;
    }
    // 小于7天
    if (diff < 604800000) {
        return `${Math.floor(diff / 86400000)}天前`;
    }
    // 超过7天显示具体日期
    return `${date.getMonth() + 1}月${date.getDate()}日`;
};

fetchData();
</script>

<style scoped lang="scss">
.user-info-card {
    .user-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid $border-color;

        .user-avatar {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, $primary-color, #764ba2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            flex-shrink: 0;
        }

        .user-basic {
            flex: 1;
            min-width: 0;

            .user-name {
                font-size: 16px;
                font-weight: 600;
                color: $text-primary;
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .user-role {
                font-size: 12px;
                color: $text-secondary;
            }
        }
    }

    .user-details {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;

        .detail-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: $text-secondary;

            span {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }
    }
}
</style>
