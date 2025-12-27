/**
 * deepTransformKeys 类型定义（类型模块，仅供 type 引用）。
 *
 * 注意：types 模块不包含运行时实现；运行时请从 befly-shared/utils/* 引入。
 */

export type KeyTransformer = (key: string) => string;

export type PresetTransform = "camel" | "snake" | "kebab" | "pascal" | "upper" | "lower";

export interface TransformOptions {
    maxDepth?: number;
    excludeKeys?: string[];
}

export type DeepTransformKeys = <T = any>(data: any, transformer: KeyTransformer | PresetTransform, options?: TransformOptions) => T;
