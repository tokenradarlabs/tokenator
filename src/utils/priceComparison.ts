export function hasCrossedThreshold(
  currentValue: number,
  previousValue: number | null,
  threshold: number,
  direction: 'up' | 'down'
): boolean {
  if (previousValue !== null) {
    if (direction === 'up') {
      return previousValue < threshold && currentValue >= threshold;
    } else { // direction === 'down'
      return previousValue > threshold && currentValue <= threshold;
    }
  } else {
    // No previous value, trigger if current value meets the threshold
    if (direction === 'up') {
      return currentValue >= threshold;
    } else { // direction === 'down'
      return currentValue <= threshold;
    }
  }
}

export function calculatePercentageChange(
  currentValue: number,
  previousValue: number
): number {
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : Infinity; // Handle division by zero
  }
  return ((currentValue - previousValue) / previousValue) * 100;
}
