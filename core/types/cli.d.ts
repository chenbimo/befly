/**
 * CLI 相关类型定义
 */

/**
 * 脚本项接口
 */
export interface ScriptItem {
    /** 脚本名称 */
    name: string;
    /** 脚本来源 (core 或 tpl) */
    source: 'core' | 'tpl';
    /** 是否与另一来源的脚本重名 */
    duplicate: boolean;
    /** 脚本完整路径 */
    path: string;
}

/**
 * 命令行参数接口
 */
export interface CliArgs {
    /** 是否为预演模式（只输出计划不执行） */
    DRY_RUN: boolean;
}

/**
 * 表文件信息接口
 */
export interface TableFileInfo {
    /** 表文件路径 */
    file: string;
    /** 文件类型：core（核心）或 project（项目） */
    type: 'core' | 'project';
}
