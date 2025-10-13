/**
 * Befly 日期时间工具
 * 提供日期格式化和性能计时功能
 */

/**
 * 格式化日期
 * @param date - 日期对象、时间戳或日期字符串
 * @param format - 格式化模板（支持 YYYY, MM, DD, HH, mm, ss）
 * @returns 格式化后的日期字符串
 *
 * @example
 * formatDate(new Date('2025-10-11 15:30:45')) // '2025-10-11 15:30:45'
 * formatDate(new Date('2025-10-11'), 'YYYY-MM-DD') // '2025-10-11'
 * formatDate(1728648645000, 'YYYY/MM/DD HH:mm') // '2025/10/11 15:30'
 * formatDate('2025-10-11', 'MM-DD') // '10-11'
 */
export const formatDate = (date: Date | string | number = new Date(), format: string = 'YYYY-MM-DD HH:mm:ss'): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');

    return format.replace('YYYY', String(year)).replace('MM', month).replace('DD', day).replace('HH', hour).replace('mm', minute).replace('ss', second);
};

/**
 * 计算性能时间差
 * 用于测量代码执行时间（使用 Bun.nanoseconds()）
 * @param startTime - 开始时间（Bun.nanoseconds()返回值）
 * @param endTime - 结束时间（可选，默认为当前时间）
 * @returns 时间差（毫秒或秒）
 *
 * @example
 * const start = Bun.nanoseconds();
 * // ... 执行代码 ...
 * const elapsed = calcPerfTime(start); // '15.23 毫秒' 或 '2.45 秒'
 */
export const calcPerfTime = (startTime: number, endTime: number = Bun.nanoseconds()): string => {
    const elapsedMs = (endTime - startTime) / 1_000_000;

    if (elapsedMs < 1000) {
        return `${elapsedMs.toFixed(2)} 毫秒`;
    } else {
        const elapsedSeconds = elapsedMs / 1000;
        return `${elapsedSeconds.toFixed(2)} 秒`;
    }
};
