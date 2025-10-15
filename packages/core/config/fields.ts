/**
 * 通用字段定义
 *
 * 用于在 API 和表定义中复用常见字段规则
 *
 * 格式：`字段标签|数据类型|最小值|最大值|默认值|是否必填|正则表达式`
 *
 * 说明：
 * - 字段标签：用于显示的中文名称
 * - 数据类型：string、number、boolean、array 等
 * - 最小值：string 类型表示最小长度，number 类型表示最小数值
 * - 最大值：string 类型表示最大长度，number 类型表示最大数值
 * - 默认值：字段的默认值，无默认值时填 null
 * - 是否必填：0 表示非必填，1 表示必填
 * - 正则表达式：用于验证字段值的正则表达式，无验证时填 null
 */

export const CommonFields = {
    _id: 'ID|number|1|null|null|1|null',
    email: '邮箱|string|5|100|null|1|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    phone: '手机号|string|11|11|null|1|^1[3-9]\\d{9}$',
    page: '页码|number|1|9999|1|0|null',
    limit: '每页数量|number|1|100|10|0|null',
    title: '标题|string|1|200|null|0|null',
    description: '描述|string|0|500|null|0|null',
    keyword: '关键词|string|1|50|null|1|null',
    keywords: '关键词列表|array|0|50|null|0|null',
    enabled: '启用状态|number|0|1|1|0|^(0|1)$',
    date: '日期|string|10|10|null|0|^\\d{4}-\\d{2}-\\d{2}$',
    datetime: '日期时间|string|19|25|null|0|^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
    filename: '文件名|string|1|255|null|0|null',
    url: '网址|string|5|500|null|0|^https?://',
    tag: '标签|array|0|10|null|0|null',
    startTime: '开始时间|number|0|9999999999999|null|0|null',
    endTime: '结束时间|number|0|9999999999999|null|0|null'
} as const;

export default CommonFields;
