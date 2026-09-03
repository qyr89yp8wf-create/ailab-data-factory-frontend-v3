const pad = value => String(value).padStart(2, '0');

export function formatDateTime(value, fallback = '-') {
  if (value == null || value === '' || value === '-') return fallback;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  const text = String(value).trim();
  const shortDateTime = text.match(/^(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (shortDateTime) return `2026-${shortDateTime[1]}-${shortDateTime[2]} ${shortDateTime[3]}:${shortDateTime[4]}:${shortDateTime[5] || '00'}`;

  const localDateTime = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (localDateTime) return `${localDateTime[1]}-${pad(localDateTime[2])}-${pad(localDateTime[3])} ${pad(localDateTime[4] || 0)}:${pad(localDateTime[5] || 0)}:${pad(localDateTime[6] || 0)}`;

  const normalized = text.includes(' ') && !text.includes('T') ? text.replace(' ', 'T') : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? text : formatDateTime(date, fallback);
}

export function nowDateTime() {
  return formatDateTime(new Date());
}

