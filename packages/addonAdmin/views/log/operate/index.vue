<template>
    <div class="page-operate-log page-table">
        <div class="main-tool">
            <div class="left">
                <TSelect v-model="$Data.filter.module" placeholder="操作模块" clearable style="width: 150px" @change="$Method.handleFilter">
                    <TOption v-for="item in $Data.moduleOptions" :key="item.value" :label="item.label" :value="item.value" />
                </TSelect>
                <TSelect v-model="$Data.filter.action" placeholder="操作类型" clearable style="width: 150px" @change="$Method.handleFilter">
                    <TOption v-for="item in $Data.actionOptions" :key="item.value" :label="item.label" :value="item.value" />
                </TSelect>
                <TSelect v-model="$Data.filter.result" placeholder="操作结果" clearable style="width: 120px" @change="$Method.handleFilter">
                    <TOption label="成功" :value="1" />
                    <TOption label="失败" :value="0" />
                </TSelect>
            </div>
            <div class="right">
                <TButton shape="circle" @click="$Method.handleRefresh">
                    <template #icon>
                        <ILucideRotateCw />
                    </template>
                </TButton>
            </div>
        </div>

        <div class="main-content">
            <div class="main-table">
                <TTable :data="$Data.tableData" :columns="$Data.columns" :loading="$Data.loading" :active-row-keys="$Data.activeRowKeys" row-key="id" height="100%" active-row-type="single" @active-change="$Method.onActiveChange">
                    <template #result="{ row }">
                        <TTag v-if="row.result === 1" shape="round" theme="success" variant="light-outline">成功</TTag>
                        <TTag v-else shape="round" theme="danger" variant="light-outline">失败</TTag>
                    </template>
                    <template #operateTime="{ row }">
                        {{ $Method.formatTime(row.operateTime) }}
                    </template>
                    <template #duration="{ row }">
                        <TTag shape="round" :theme="row.duration > 1000 ? 'warning' : 'default'" variant="light-outline">{{ row.duration }}ms</TTag>
                    </template>
                    <template #action="{ row }">
                        <TTag shape="round" variant="light-outline">{{ row.action }}</TTag>
                    </template>
                </TTable>
            </div>

            <div class="main-detail">
                <DetailPanel :data="$Data.currentRow" :fields="$Data.detailFields">
                    <template #result="{ value }">
                        <TTag v-if="value === 1" shape="round" theme="success" variant="light-outline">成功</TTag>
                        <TTag v-else shape="round" theme="danger" variant="light-outline">失败</TTag>
                    </template>
                    <template #operateTime="{ value }">
                        {{ $Method.formatTime(value) }}
                    </template>
                    <template #duration="{ value }">
                        <TTag shape="round" :theme="value > 1000 ? 'warning' : 'default'" variant="light-outline">{{ value }}ms</TTag>
                    </template>
                    <template #params="{ value }">
                        <pre class="json-content">{{ $Method.formatJson(value) }}</pre>
                    </template>
                    <template #response="{ value }">
                        <pre class="json-content">{{ $Method.formatJson(value) }}</pre>
                    </template>
                </DetailPanel>
            </div>
        </div>

        <div class="main-page">
            <TPagination :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.limit" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @page-size-change="$Method.handleSizeChange" />
        </div>
    </div>
</template>

<script setup>
import { Button as TButton, Table as TTable, Tag as TTag, Pagination as TPagination, Select as TSelect, Option as TOption, MessagePlugin } from 'tdesign-vue-next';
import ILucideRotateCw from '~icons/lucide/rotate-cw';
import DetailPanel from '@/components/DetailPanel.vue';
import { $Http } from '@/plugins/http';
import { withDefaultColumns } from 'befly-vite/utils/withDefaultColumns';

// 响应式数据
const $Data = $ref({
    tableData: [],
    loading: false,
    columns: withDefaultColumns([
        { colKey: 'username', title: '操作人', fixed: 'left', width: 100 },
        { colKey: 'id', title: '序号', width: 80 },
        { colKey: 'module', title: '模块', width: 100 },
        { colKey: 'action', title: '操作', width: 80 },
        { colKey: 'path', title: '请求路径', ellipsis: true },
        { colKey: 'ip', title: 'IP地址', width: 130 },
        { colKey: 'duration', title: '耗时', width: 100 },
        { colKey: 'operateTime', title: '操作时间', width: 170 },
        { colKey: 'result', title: '结果', width: 80 }
    ]),
    detailFields: [
        { colKey: 'username', title: '操作人账号' },
        { colKey: 'nickname', title: '操作人昵称' },
        { colKey: 'module', title: '操作模块' },
        { colKey: 'action', title: '操作类型' },
        { colKey: 'method', title: '请求方法' },
        { colKey: 'path', title: '请求路径' },
        { colKey: 'ip', title: 'IP地址' },
        { colKey: 'params', title: '请求参数' },
        { colKey: 'response', title: '响应内容' },
        { colKey: 'duration', title: '耗时' },
        { colKey: 'operateTime', title: '操作时间' },
        { colKey: 'result', title: '操作结果' },
        { colKey: 'remark', title: '备注' }
    ],
    pagerConfig: {
        currentPage: 1,
        limit: 30,
        total: 0
    },
    currentRow: null,
    activeRowKeys: [],
    filter: {
        module: '',
        action: '',
        result: null
    },
    moduleOptions: [
        { label: '管理员', value: '管理员' },
        { label: '角色', value: '角色' },
        { label: '菜单', value: '菜单' },
        { label: '接口', value: '接口' },
        { label: '字典', value: '字典' }
    ],
    actionOptions: [
        { label: '新增', value: '新增' },
        { label: '编辑', value: '编辑' },
        { label: '删除', value: '删除' },
        { label: '查询', value: '查询' }
    ]
});

// 方法
const $Method = {
    async initData() {
        await $Method.apiOperateLogList();
    },

    // 加载操作日志列表
    async apiOperateLogList() {
        $Data.loading = true;
        try {
            const res = await $Http('/addon/admin/operateLog/list', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.limit
            });
            $Data.tableData = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;

            if ($Data.tableData.length > 0) {
                $Data.currentRow = $Data.tableData[0];
                $Data.activeRowKeys = [$Data.tableData[0].id];
            } else {
                $Data.currentRow = null;
                $Data.activeRowKeys = [];
            }
        } catch (error) {
            MessagePlugin.error('加载数据失败');
        } finally {
            $Data.loading = false;
        }
    },

    // 筛选
    handleFilter() {
        $Data.pagerConfig.currentPage = 1;
        $Method.apiOperateLogList();
    },

    // 刷新
    handleRefresh() {
        $Method.apiOperateLogList();
    },

    // 分页改变
    onPageChange(currentPage) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.apiOperateLogList();
    },

    // 每页条数改变
    handleSizeChange(pageSize) {
        $Data.pagerConfig.limit = pageSize;
        $Data.pagerConfig.currentPage = 1;
        $Method.apiOperateLogList();
    },

    // 高亮行变化
    onActiveChange(value, context) {
        if (value.length === 0 && $Data.activeRowKeys.length > 0) {
            return;
        }
        $Data.activeRowKeys = value;
        if (context.activeRowList && context.activeRowList.length > 0) {
            $Data.currentRow = context.activeRowList[0].row;
        }
    },

    // 格式化时间
    formatTime(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    },

    // 格式化 JSON
    formatJson(value) {
        if (!value) return '-';
        try {
            const obj = typeof value === 'string' ? JSON.parse(value) : value;
            return JSON.stringify(obj, null, 2);
        } catch {
            return value;
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.json-content {
    margin: 0;
    padding: 8px;
    background: var(--td-bg-color-container);
    border-radius: 4px;
    font-size: 12px;
    max-height: 200px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
}
</style>
