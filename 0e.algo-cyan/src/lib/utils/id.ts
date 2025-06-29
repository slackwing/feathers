export function toBase34Max39304(num: number): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Skips I and O
  const base = chars.length;
  const maxValue = Math.pow(base, 3);
  if (num < 0) throw new Error('Number must be non-negative');
  let n = num % maxValue;
  let result = '';
  while (result.length < 3) {
    result = chars[n % base] + result;
    n = Math.floor(n / base);
  }
  return result;
}

let globalCounter = 0;

export function generateId(prefix: string): string {
  const counterStr = toBase34Max39304(globalCounter++);
  return `${prefix}-${counterStr}`;
}