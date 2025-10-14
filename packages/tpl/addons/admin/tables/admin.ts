/**
 * 管理员表结构
 */

import { Table } from 'befly';

export default Table('管理员表', {
    id: '管理员ID|int|0',
    name: '姓名|varchar|50|null',
    email: '邮箱|varchar|100|null',
    phone: '手机号|varchar|20|null',
    password: '密码|varchar|255|null',
    role: '角色|enum|admin,user|admin',
    status: '状态|tinyint|1|1', // 1-启用 0-禁用
    last_login_time: '最后登录时间|datetime|null',
    last_login_ip: '最后登录IP|varchar|50|null',
    created_at: '创建时间|datetime|null',
    updated_at: '更新时间|datetime|null'
});
