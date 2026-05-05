export function formatPublicationsCountLabel(count: number): string {
  const absoluteCount = Math.abs(count);
  const lastTwoDigits = absoluteCount % 100;
  const lastDigit = absoluteCount % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'публикаций';
  }

  if (lastDigit === 1) {
    return 'публикация';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'публикации';
  }

  return 'публикаций';
}
