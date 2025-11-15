<template>
    <t-dialog v-model:visible="$Data.visible" title="接口权限" width="900px" :append-to-body="true" :show-footer="true" top="5vh" @close="$Method.onClose">
        <div class="comp-role-api">
            <!-- 搜索框 -->
            <div class="search-box">
                <TinySearch v-model="$Data.searchText" placeholder="搜索接口名称或路径" clearable @update:modelValue="$Method.onSearch" />
            </div>

            <!-- 接口分组列表 -->
            <div class="api-container">
                <div v-for="group in $Data.filteredApiData" :key="group.name" class="api-group">
                    <div class="group-header">{{ group.title }}</div>
                    <div class="api-checkbox-list">
                        <TinyCheckboxGroup v-model="$Data.checkedApiIds">
                            <TinyCheckbox v-for="api in group.apis" :key="api.id" :label="api.id"> {{ api.label }} </TinyCheckbox>
                        </TinyCheckboxGroup>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="footer-left">
                <t-button size="small" @click="$Method.onCheckAll">全选</t-button>
                <t-button size="small" @click="$Method.onUncheckAll">取消全选</t-button>
            </div>
            <div class="footer-right">
                <t-button @click="$Method.onClose">取消</t-button>
                <t-button type="primary" @click="$Method.onSubmit">保存</t-button>
            </div>
        </template>
    </t-dialog>
</template>

<script setup>
import { $Http } from '@/plugins/http';

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
    checkedApiIds: []
});

// 方法集合
const $Method = {
    async initData() {
        $Method.onShow();
        await Promise.all([$Method.apiApiAll(), $Method.apiRoleApiDetail()]);
        $Data.filteredApiData = $Data.apiData;
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
            const res = await $Http('/addon/admin/api/all');

            // 将接口列表按 addonTitle 分组
            const apiMap = new Map();

            res.data.lists.forEach((api) => {
                const addonTitle = api.addonTitle || api.addonName || '项目接口';
                const addonName = api.addonName || 'project';

                if (!apiMap.has(addonName)) {
                    apiMap.set(addonName, {
                        name: addonName,
                        title: addonTitle,
                        apis: []
                    });
                }

                apiMap.get(addonName).apis.push({
                    id: api.id,
                    label: `${api.name}`,
                    description: api.description
                });
            });

            $Data.apiData = Array.from(apiMap.values());
        } catch (error) {
            console.error('加载接口失败:', error);
            MessagePlugin.info({ message: '加载接口失败', status: 'error' });
        }
    },

    // 加载该角色已分配的接口
    async apiRoleApiDetail() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http('/addon/admin/role/apiDetail', {
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

    // 提交表单
    async onSubmit() {
        try {
            const res = await $Http('/addon/admin/role/apiSave', {
                roleId: $Prop.rowData.id,
                apiIds: $Data.checkedApiIds
            });

            if (res.code === 0) {
                MessagePlugin.info({
                    message: '保存成功',
                    status: 'success'
                });
                $Data.visible = false;
                $Emit('success');
            } else {
                MessagePlugin.info({
                    message: res.msg || '保存失败',
                    status: 'error'
                });
            }
        } catch (error) {
            console.error('保存失败:', error);
            MessagePlugin.info({
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
    }

    .api-container {
        flex: 1;
        overflow-y: auto;

        .api-group {
            margin-bottom: 16px;
            border: 1px solid $border-color;
            border-radius: $border-radius-small;
            overflow: hidden;

            &:last-child {
                margin-bottom: 0;
            }

            .group-header {
                padding: 12px 16px;
                background-color: $bg-color-hover;
                font-weight: 500;
                font-size: $font-size-sm;
                color: $text-primary;
                display: flex;
                align-items: center;
                gap: 8px;

                &::before {
                    content: '';
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: $primary-color;
                    opacity: 0.3;
                    flex-shrink: 0;
                }
            }

            .api-checkbox-list {
                padding: 16px;
                background-color: $bg-color-container;

                :deep(.tiny-checkbox-group) {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    width: 100%;
                }

                :deep(.tiny-checkbox) {
                    flex: 0 0 calc(33.333% - 8px);
                    margin: 0;

                    .tiny-checkbox__label {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                }
            }
        }
    }
}

// 底部操作栏布局
:deep(.tiny-dialog-box__footer) {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .footer-left {
        display: flex;
        gap: 8px;
    }

    .footer-right {
        display: flex;
        gap: 8px;
    }
}
</style>
