export const SALES_TIME_SLOTS = [
  "09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00", "11:20", "11:40", "12:00", "12:20", "12:40",
  "01:00", "01:20", "01:40", "02:00", "02:20", "02:40", "03:00", "03:20", "03:40", "04:00", "04:20", "04:40", "05:00", "05:20", "05:40",
  "06:00", "06:20", "06:40", "07:00", "07:20", "07:40", "08:00", "08:20", "08:40", "09:00", "09:20", "09:40", "10:00", "10:20", "10:40",
] as const;

export function resolveSalesSlots(slots: readonly string[]) {
  let offsetMinutes = 0;
  let previous = -1;

  return slots.map((label, index) => {
    const [hourPart, minutePart] = label.split(":").map((part) => Number(part));
    let hour = hourPart % 12;
    if (hour === 0) {
      hour = 12;
    }

    let absolute = hour * 60 + minutePart + offsetMinutes;
    while (absolute <= previous) {
      offsetMinutes += 12 * 60;
      absolute = hour * 60 + minutePart + offsetMinutes;
    }

    previous = absolute;
    return {
      id: `${label}-${index}`,
      label,
      minutes: absolute,
    };
  });
}

export const RESOLVED_SALES_SLOTS = resolveSalesSlots(SALES_TIME_SLOTS);

/**
 * Calculates the number of seconds remaining until the NEXT time slot boundary.
 * E.g., if now is 09:13:00 and the next slot is 09:15:00, returns 120.
 */
export function getSecondsUntilNextSlot(now: Date = new Date()) {
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  for (const slot of RESOLVED_SALES_SLOTS) {
    const slotSeconds = slot.minutes * 60;
    if (currentSeconds < slotSeconds) {
      return slotSeconds - currentSeconds;
    }
  }

  // If we are past the very last slot of the day, the next slot is the first slot of the next day.
  const firstSlotSeconds = RESOLVED_SALES_SLOTS[0].minutes * 60;
  return (24 * 3600 - currentSeconds) + firstSlotSeconds;
}

/**
 * Returns true if receipt generation should be blocked.
 * The lock activates exactly 60 seconds before the upcoming slot ends.
 */
export function isReceiptGenerationLocked(now: Date = new Date()) {
  return getSecondsUntilNextSlot(now) <= 60;
}
