export function formatYmdHms(date: Date, format: "date" | "time" | "dateTime" = "dateTime"): string {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours();
    const mi = date.getMinutes();
    const s = date.getSeconds();

    const mm = m < 10 ? `0${m}` : String(m);
    const dd = d < 10 ? `0${d}` : String(d);
    const hh = h < 10 ? `0${h}` : String(h);
    const mii = mi < 10 ? `0${mi}` : String(mi);
    const ss = s < 10 ? `0${s}` : String(s);

    if (format === "date") {
        return `${y}-${mm}-${dd}`;
    }
    if (format === "time") {
        return `${hh}:${mii}:${ss}`;
    }

    return `${y}-${mm}-${dd} ${hh}:${mii}:${ss}`;
}
