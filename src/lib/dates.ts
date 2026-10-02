/** Date formats used by the Hugo templates, always in UTC like the Hugo build. */

const longDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
});

/** `Monday, January 2, 2006` */
export const formatLongDate = (date: Date) => longDate.format(date);

/** `2006-01-02T15:04:05-07:00` */
export const formatIso = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, "+00:00");

/** `Mon, 02 Jan 2006 15:04:05 -0700`, with Hugo's zero date for undated pages. */
export const formatRfc822 = (date?: Date) =>
    date ? date.toUTCString().replace("GMT", "+0000") : "Mon, 01 Jan 0001 00:00:00 +0000";
