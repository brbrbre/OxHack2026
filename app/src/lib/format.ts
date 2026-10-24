export function money(value: number, signed = false): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value).replace('US$', '$')
}

export function percentage(value: number, signed = false): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value)
}

export function price(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function dateLabel(value: string, long = false): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: long ? 'numeric' : undefined,
    month: 'short',
    year: long ? 'numeric' : undefined,
    timeZone: 'UTC',
  }).format(new Date(value + 'T12:00:00Z'))
}
