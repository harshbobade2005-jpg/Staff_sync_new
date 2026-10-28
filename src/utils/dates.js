import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import { env, weekendDays } from '../config/env.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const TZ = env.COMPANY_TZ;

/** Today's date key in company timezone: "YYYY-MM-DD" */
export function todayKey() {
  return dayjs().tz(TZ).format('YYYY-MM-DD');
}

/** Convert any date/timestamp to a date key string in company TZ */
export function toDateKey(date) {
  return dayjs(date).tz(TZ).format('YYYY-MM-DD');
}

/** Generate an array of date keys between start and end (inclusive) */
export function eachDateKey(startKey, endKey) {
  const keys = [];
  let cur = dayjs.tz(startKey, TZ);
  const end = dayjs.tz(endKey, TZ);
  while (!cur.isAfter(end)) {
    keys.push(cur.format('YYYY-MM-DD'));
    cur = cur.add(1, 'day');
  }
  return keys;
}

/** Is the given date key a weekend day? */
export function isWeekend(key) {
  const dow = dayjs.tz(key, TZ).day(); // 0=Sun … 6=Sat
  return weekendDays.includes(dow);
}

/** Count working days between start and end (inclusive), excluding weekends and given holiday keys */
export function countWorkingDays(startKey, endKey, holidayKeys = []) {
  const holidaySet = new Set(holidayKeys);
  return eachDateKey(startKey, endKey).filter(
    (k) => !isWeekend(k) && !holidaySet.has(k)
  ).length;
}

/** Minutes between two Date objects */
export function minutesBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 60000);
}

/** Local time string "HH:mm" of a Date in company timezone */
export function localTimeOf(date) {
  return dayjs(date).tz(TZ).format('HH:mm');
}

/** Parse "HH:mm" time string on a given date key, return a dayjs in company TZ */
export function parseDateTimeInTZ(dateKey, timeStr) {
  return dayjs.tz(`${dateKey} ${timeStr}`, TZ);
}
