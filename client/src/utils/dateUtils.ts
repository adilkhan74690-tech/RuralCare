/**
 * Date and Time Utilities for RuralCare Connect
 * Enforces local timezone interpretation to prevent UTC conversion bugs
 * where midnight UTC shifts visits to the previous or next calendar day.
 */

/**
 * Returns the local calendar date string formatted as YYYY-MM-DD.
 * Always respects the user's/device's local timezone.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely parses a YYYY-MM-DD string into a local Date object set to 00:00:00 local time,
 * completely avoiding the new Date("YYYY-MM-DD") UTC midnight trap.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  if (dateStr.includes('T')) {
    // If it's already an ISO timestamp, parse directly
    return new Date(dateStr);
  }

  // Parse YYYY-MM-DD as local numbers
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day, 0, 0, 0, 0);
    }
  }

  return new Date(dateStr);
}

/**
 * Compares whether a given date string represents today in the local timezone.
 */
export function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  const targetDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const todayStr = getLocalDateString(new Date());
  return targetDateStr === todayStr;
}

/**
 * Checks if a given date string is strictly in the past (before today's local date).
 */
export function isPastDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const targetDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const todayStr = getLocalDateString(new Date());
  return targetDateStr < todayStr;
}

/**
 * Checks if a given date string is strictly in the future (after today's local date).
 */
export function isFutureDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const targetDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const todayStr = getLocalDateString(new Date());
  return targetDateStr > todayStr;
}

/**
 * Returns human-readable date display with friendly relative labels ("Today", "Tomorrow", "Yesterday").
 */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return 'Unscheduled';
  
  const targetStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const todayStr = getLocalDateString(new Date());
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrow);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  if (targetStr === todayStr) {
    return 'Today';
  }
  if (targetStr === tomorrowStr) {
    return 'Tomorrow';
  }
  if (targetStr === yesterdayStr) {
    return 'Yesterday';
  }

  const d = parseLocalDate(targetStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Returns formatted local calendar date with relative indicators, e.g. "Today (Oct 31, 2026)"
 * or "Yesterday (Oct 30, 2026) • Overdue".
 */
export function formatFullLocalDate(dateStr: string): string {
  if (!dateStr) return 'Not specified';
  const targetStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const d = parseLocalDate(targetStr);
  const formatted = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const todayStr = getLocalDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrow);

  if (targetStr === todayStr) return `Today (${formatted})`;
  if (targetStr === yesterdayStr) return `Yesterday (${formatted}) • Overdue`;
  if (targetStr === tomorrowStr) return `Tomorrow (${formatted})`;
  if (targetStr < todayStr) return `${formatted} • Overdue`;
  return formatted;
}

/**
 * Formats a 24-hour time string ("14:30") into a friendly 12-hour display ("2:30 PM").
 */
export function formatTimeDisplay(timeStr?: string): string {
  if (!timeStr) return '';
  
  // If already formatted with AM/PM
  if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) {
    return timeStr;
  }

  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0');
    if (!isNaN(hours)) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm}`;
    }
  }

  return timeStr;
}

/**
 * Combine local calendar date and optional time into a clean local ISO-compatible representation.
 */
export function combineDateAndTime(dateStr: string, timeStr?: string): string {
  if (!timeStr) return dateStr;
  return `${dateStr}T${timeStr.trim()}`;
}
