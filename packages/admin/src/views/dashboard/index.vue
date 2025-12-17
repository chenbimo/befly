<template>
    <div class="dashboard">
        <div class="header">
            <div class="title">工作台</div>
            <div class="desc">这里是业务首页（admin 自有页面），系统管理功能仍在 /addon/admin/*。</div>
        </div>

        <div class="cards">
            <TCard class="card" title="今日概览" :bordered="false">
                <div class="kv">
                    <div class="item">
                        <div class="k">新增用户</div>
                        <div class="v">—</div>
                    </div>
                    <div class="item">
                        <div class="k">新增订单</div>
                        <div class="v">—</div>
                    </div>
                    <div class="item">
                        <div class="k">待处理事项</div>
                        <div class="v">—</div>
                    </div>
                </div>
            </TCard>

            <TCard class="card" title="快捷入口" :bordered="false">
                <div class="quick">
                    <TButton theme="primary" variant="base" @click="$Method.goSystem">进入系统管理</TButton>
                    <TButton theme="default" variant="outline" @click="$Method.refresh">刷新</TButton>
                </div>
            </TCard>
        </div>
    </div>
</template>

<script setup>
import { Button as TButton, Card as TCard } from "tdesign-vue-next";

definePage({
    meta: {
        title: "工作台",
        layout: "default"
    }
});

const router = useRouter();

const $Method = {
    goSystem() {
        router.push("/addon/admin");
    },
    refresh() {
        window.location.reload();
    }
};
</script>

<style scoped lang="scss">
.dashboard {
    padding: 16px;
}

.header {
    padding: 12px 0;

    .title {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 6px;
    }

    .desc {
        font-size: 12px;
        color: var(--text-secondary);
    }
}

.cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 12px;
}

.card {
    border-radius: var(--border-radius-large);
}

.kv {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;

    .item {
        padding: 10px 12px;
        border-radius: var(--border-radius);
        background: var(--bg-color-page);

        .k {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        .v {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
        }
    }
}

.quick {
    display: flex;
    gap: 10px;
}
</style>
