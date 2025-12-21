/**
 * Schedule Utilities
 * 予約投稿の時間枠関連ユーティリティ
 */

// 予約枠（JST時刻）
const SCHEDULE_SLOTS = [
    { hour: 7, minute: 30 },
    { hour: 12, minute: 10 },
    { hour: 21, minute: 30 },
] as const;

/**
 * ランダムなジッター（分）を生成
 * @returns -7 〜 +7 分のランダム値
 */
function getJitterMinutes(): number {
    // ±3〜7分の範囲でランダム
    const sign = Math.random() < 0.5 ? -1 : 1;
    const magnitude = 3 + Math.floor(Math.random() * 5); // 3〜7
    return sign * magnitude;
}

/**
 * ランダムな秒を生成
 * @returns 10〜50秒のランダム値
 */
function getRandomSeconds(): number {
    return 10 + Math.floor(Math.random() * 41); // 10〜50
}

/**
 * 次に来る予約枠を取得（JST基準）+ ジッター付き
 * @param withJitter ジッターを追加するか（デフォルト: true）
 * @returns datetime-local形式の文字列 (YYYY-MM-DDTHH:MM)
 */
export function getNextSlot(withJitter: boolean = true): string {
    // 現在時刻をJSTで取得
    const now = new Date();
    const jstOffset = 9 * 60; // JST = UTC+9
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    // JST日付を計算
    const jstDate = new Date(now.getTime() + jstOffset * 60 * 1000);
    let year = jstDate.getUTCFullYear();
    let month = jstDate.getUTCMonth();
    let day = jstDate.getUTCDate();

    // 現在のJST時刻（分単位）を計算
    const currentMinutes = ((utcMinutes + jstOffset) % (24 * 60) + 24 * 60) % (24 * 60);

    // 今日の枠から次に来る枠を探す
    let targetHour: number;
    let targetMinute: number;
    let isNextDay = false;

    let found = false;
    for (const slot of SCHEDULE_SLOTS) {
        const slotMinutes = slot.hour * 60 + slot.minute;
        if (currentMinutes < slotMinutes) {
            targetHour = slot.hour;
            targetMinute = slot.minute;
            found = true;
            break;
        }
    }

    if (!found) {
        // 今日の枠は全て過ぎた → 明日の最初の枠
        const firstSlot = SCHEDULE_SLOTS[0];
        targetHour = firstSlot.hour;
        targetMinute = firstSlot.minute;
        isNextDay = true;
    }

    // ジッターを追加
    let finalMinute = targetMinute!;
    let finalSecond = 0;

    if (withJitter) {
        const jitterMinutes = getJitterMinutes();
        finalMinute = targetMinute! + jitterMinutes;
        finalSecond = getRandomSeconds();

        // 分が負になった場合や60以上になった場合の調整
        // (枠の概念を壊さないため、大きくずらさない)
        if (finalMinute < 0) finalMinute = 0;
        if (finalMinute >= 60) finalMinute = 59;
    }

    // 日付を計算
    if (isNextDay) {
        const tomorrow = new Date(Date.UTC(year, month, day + 1));
        year = tomorrow.getUTCFullYear();
        month = tomorrow.getUTCMonth();
        day = tomorrow.getUTCDate();
    }

    return formatDateTimeLocal(year, month, day, targetHour!, finalMinute, finalSecond);
}

/**
 * datetime-local形式にフォーマット
 * 秒は無視される（datetime-localは秒をサポートしない）
 */
function formatDateTimeLocal(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    _second?: number
): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

/**
 * 予約枠の一覧を取得
 */
export function getScheduleSlots() {
    return SCHEDULE_SLOTS.map(slot => ({
        label: `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`,
        hour: slot.hour,
        minute: slot.minute,
    }));
}
