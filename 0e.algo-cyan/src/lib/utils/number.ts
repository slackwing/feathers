export function roundQuantity(qty: number): number {
  return Math.round(qty * 1e9) / 1e9;
} 