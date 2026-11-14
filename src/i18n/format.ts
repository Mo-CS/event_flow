import { getLanguage } from "./translate"

/** Locale used by all date/number/currency formatting in the app. */
export function formatLocale(): string {
  return getLanguage() === "ar" ? "ar" : "en-US"
}

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

export function formatDate(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return toDate(value).toLocaleDateString(formatLocale(), options)
}

export function formatDateTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return toDate(value).toLocaleString(formatLocale(), options)
}

export function formatTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return toDate(value).toLocaleTimeString(formatLocale(), options)
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(formatLocale(), options)
}

export function formatCurrency(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(formatLocale(), {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}
