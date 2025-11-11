<template>
    <div class="section-block user-info-card">
        <div class="user-header">
            <div class="user-avatar">
                <i-lucide:user style="width: 32px; height: 32px" />
            </div>
            <div class="user-basic">
                <div class="user-name">{{ $Data.userInfo.nickname || $Data.userInfo.name || $Data.userInfo.username || '未设置' }}</div>
                <div class="user-role">{{ $Data.userInfo.role?.name || '普通用户' }}</div>
            </div>
        </div>
        <div class="user-details">
            <div class="detail-item">
                <i-lucide:mail style="width: 14px; height: 14px" />
                <span>{{ $Data.userInfo.email || '未设置' }}</span>
            </div>
            <div v-if="$Data.userInfo.phone" class="detail-item">
                <i-lucide:phone style="width: 14px; height: 14px" />
                <span>{{ $Data.userInfo.phone }}</span>
            </div>
            <div v-if="$Data.userInfo.lastLoginTime" class="detail-item">
                <i-lucide:clock style="width: 14px; height: 14px" />
                <span>{{ $Method.formatTime($Data.userInfo.lastLoginTime) }}</span>
            </div>
        </div>

        <!-- 仅 dev 角色显示刷新缓存按钮 -->
        <div v-if="$Data.userInfo.roleCode === 'dev'" class="user-actions">
            <tiny-button type="primary" size="mini" :loading="$Data.refreshing" @click="$Method.handleRefreshCache">
                <template #icon>
                    <i-lucide:rotate-cw style="width: 14px; height: 14px" />
                </template>
                刷新缓存
            </tiny-button>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

// 响应式数据
const $Data = $ref({
    userInfo: {},
    refreshing: false
});

// 方法集合
const $Method = {
    // 获取数据
    async fetchData() {
        try {
            const { data } = await $Http('/addon/admin/admin/info');
            Object.assign($Data.userInfo, data);
        } catch (error) {
            console.error('获取用户信息失败:', error);
        }
    },

    // 刷新缓存
    async handleRefreshCache() {
        try {
            $Data.refreshing = true;
            const result = await $Http('/addon/admin/admin/cacheRefresh');

            if (result.code === 0) {
                const { apis, menus, roles } = result.data;
                const messages = [];

                if (apis.success) {
                    messages.push(`接口缓存: ${apis.count} 个`);
                }
                if (menus.success) {
                    messages.push(`菜单缓存: ${menus.count} 个`);
                }
                if (roles.success) {
                    messages.push(`角色缓存: ${roles.count} 个`);
                }

                TinyMessage.success({
                    message: `缓存刷新成功！${messages.join('，')}`,
                    duration: 3000
                });
            } else {
                TinyMessage.warning({
                    message: result.msg || '部分缓存刷新失败',
                    duration: 3000
                });
            }
        } catch (error) {
            console.error('刷新缓存失败:', error);
            TinyMessage.error({
                message: '刷新缓存失败，请稍后重试',
                duration: 3000
            });
        } finally {
            $Data.refreshing = false;
        }
    },

    // 格式化时间
    formatTime(timestamp) {
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
    }
};

// 初始化
$Method.fetchData();
</script>

<style scoped lang="scss">
.user-info-card {
    background-color: #fff;
    padding: 15px;
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

    .user-actions {
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid $border-color;
        display: flex;
        justify-content: center;
    }
}
</style>
