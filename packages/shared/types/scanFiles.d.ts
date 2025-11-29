export interface ScanFileResult {
    filePath: string;
    relativePath: string;
    fileName: string;
}
/**
 * 扫描指定目录下的文件
 * @param dir 目录路径
 * @param pattern Glob 模式
 * @param ignoreUnderline 是否忽略下划线开头的文件/目录
 */
export declare function scanFiles(dir: string, pattern?: string, ignoreUnderline?: boolean): Promise<ScanFileResult[]>;
