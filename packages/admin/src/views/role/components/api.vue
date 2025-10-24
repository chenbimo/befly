<template>
    <tiny-dialog-box v-model:visible="$Data.visible" title="接口权限" width="900px" :append-to-body="true" :show-footer="true" top="5vh" @close="$Method.onClose">
        <div class="comp-role-api">
            <!-- 搜索框 -->
            <div class="search-box">
                <tiny-input v-model="$Data.searchText" placeholder="搜索接口名称或路径" clearable @input="$Method.onSearch">
                    <template #prefix>
                        <icon-search />
                    </template>
                </tiny-input>
            </div>

            <!-- 操作按钮 -->
            <div class="action-buttons">
                <tiny-button size="small" @click="$Method.onCheckAll">全选</tiny-button>
                <tiny-button size="small" @click="$Method.onUncheckAll">取消全选</tiny-button>
                <tiny-button size="small" @click="$Method.onExpandAll">展开全部</tiny-button>
                <tiny-button size="small" @click="$Method.onCollapseAll">折叠全部</tiny-button>
            </div>

            <!-- 折叠面板 -->
            <div class="collapse-container">
                <tiny-collapse v-model="$Data.activeNames">
                    <tiny-collapse-item v-for="group in $Data.filteredApiData" :key="group.name" :name="group.name" :title="group.name">
                        <div class="api-checkbox-list">
                            <tiny-checkbox-group v-model="$Data.checkedApiIds">
                                <tiny-checkbox v-for="api in group.apis" :key="api.id" :label="api.id">
                                    {{ api.label }}
                                </tiny-checkbox>
                            </tiny-checkbox-group>
                        </div>
                    </tiny-collapse-item>
                </tiny-collapse>
            </div>
        </div>

        <template #footer>
            <tiny-button @click="$Method.onClose">取消</tiny-button>
            <tiny-button type="primary" @click="$Method.onSubmit">保存</tiny-button>
        </template>
    </tiny-dialog-box>
</template>

<script setup>
import { IconSearch } from '@opentiny/vue-icon';

const $Prop = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    rowData: {
        type: Object,
        default: () => ({})
    }
});

const $Emit = defineEmits(['update:modelValue', 'success']);

const $Data = $ref({
    visible: false,
    apiData: [],
    filteredApiData: [],
    searchText: '',
    checkedApiIds: [],
    activeNames: []
});

// 方法集合
const $Method = {
    async initData() {
        $Method.onShow();
        await Promise.all([$Method.apiApiAll(), $Method.apiRoleApiDetail()]);
        $Data.filteredApiData = $Data.apiData;
        // 默认展开所有折叠面板
        $Data.activeNames = $Data.apiData.map((group) => group.name);
    },

    onShow() {
        setTimeout(() => {
            $Data.visible = $Prop.modelValue;
        }, 100);
    },

    onClose() {
        $Data.visible = false;
        setTimeout(() => {
            $Emit('update:modelValue', false);
        }, 300);
    },

    // 加载所有接口
    async apiApiAll() {
        try {
            const res = await $Http('/addon/admin/apiAll');

            // 将接口列表按 addonName 分组
            const apiMap = new Map();

            res.data.lists.forEach((api) => {
                const addonName = api.addonName || '项目接口';

                if (!apiMap.has(addonName)) {
                    apiMap.set(addonName, {
                        name: addonName,
                        apis: []
                    });
                }

                apiMap.get(addonName).apis.push({
                    id: api.id,
                    label: `${api.name} [${api.method} ${api.path}]`,
                    description: api.description
                });
            });

            $Data.apiData = Array.from(apiMap.values());
        } catch (error) {
            console.error('加载接口失败:', error);
            Modal.message({ message: '加载接口失败', status: 'error' });
        }
    },

    // 加载该角色已分配的接口
    async apiRoleApiDetail() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http('/addon/admin/roleApiDetail', {
                roleId: $Prop.rowData.id
            });

            $Data.checkedApiIds = res.data.apiIds || [];
        } catch (error) {
            console.error('加载角色接口失败:', error);
        }
    },

    // 搜索过滤
    onSearch() {
        if (!$Data.searchText) {
            $Data.filteredApiData = $Data.apiData;
            return;
        }

        const searchLower = $Data.searchText.toLowerCase();
        $Data.filteredApiData = $Data.apiData
            .map((group) => ({
                ...group,
                apis: group.apis.filter((api) => api.label.toLowerCase().includes(searchLower))
            }))
            .filter((group) => group.apis.length > 0);
    },

    // 全选
    onCheckAll() {
        const allApiIds = [];
        $Data.apiData.forEach((group) => {
            group.apis.forEach((api) => {
                allApiIds.push(api.id);
            });
        });
        $Data.checkedApiIds = allApiIds;
    },

    // 取消全选
    onUncheckAll() {
        $Data.checkedApiIds = [];
    },

    // 展开全部
    onExpandAll() {
        $Data.activeNames = $Data.apiData.map((group) => group.name);
    },

    // 折叠全部
    onCollapseAll() {
        $Data.activeNames = [];
    },

    // 提交表单
    async onSubmit() {
        try {
            const res = await $Http('/addon/admin/roleApiSave', {
                roleId: $Prop.rowData.id,
                apiIds: JSON.stringify($Data.checkedApiIds)
            });

            if (res.code === 0) {
                Modal.message({
                    message: '保存成功',
                    status: 'success'
                });
                $Data.visible = false;
                $Emit('success');
            } else {
                Modal.message({
                    message: res.msg || '保存失败',
                    status: 'error'
                });
            }
        } catch (error) {
            console.error('保存失败:', error);
            Modal.message({
                message: '保存失败',
                status: 'error'
            });
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.comp-role-api {
    height: 60vh;
    display: flex;
    flex-direction: column;
    gap: 12px;

    .search-box {
        padding-bottom: 8px;
        border-bottom: 1px solid var(--ti-common-color-line-dividing);
    }

    .action-buttons {
        display: flex;
        gap: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--ti-common-color-line-dividing);
    }

    .collapse-container {
        flex: 1;
        overflow-y: auto;

        .api-checkbox-list {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            padding: 12px 0;

            :deep(.tiny-checkbox-group) {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                width: 100%;
            }

            :deep(.tiny-checkbox) {
                flex: 0 0 auto;
                min-width: 280px;
                max-width: 400px;
                margin: 0;

                .tiny-checkbox__label {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            }
        }

        :deep(.tiny-collapse) {
            border: none;

            .tiny-collapse-item {
                margin-bottom: 8px;
                border: 1px solid var(--ti-common-color-line-dividing);
                border-radius: 4px;

                &:last-child {
                    margin-bottom: 0;
                }

                .tiny-collapse-item__header {
                    padding: 12px 16px;
                    background-color: var(--ti-common-color-bg-navigation);
                    border-radius: 4px 4px 0 0;
                    font-weight: 500;

                    &:hover {
                        background-color: var(--ti-common-color-hover-background);
                    }
                }

                .tiny-collapse-item__content {
                    padding: 0 16px;
                    border-top: 1px solid var(--ti-common-color-line-dividing);
                }
            }
        }
    }
}
</style>
