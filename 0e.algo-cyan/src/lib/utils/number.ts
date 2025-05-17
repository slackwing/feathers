const EPSILON = 1e-9;

export function roundQuantity(qty: number): number {
  return Number(qty.toFixed(9));
}

export function eq(a: number, b: number): boolean {
  return (a - b) < EPSILON && (b - a) < EPSILON;
}

export function lt(a: number, b: number): boolean {
  return (b - a) > EPSILON;
}

export function lte(a: number, b: number): boolean {
  return (b - a) > -EPSILON;
}

export function gt(a: number, b: number): boolean {
  return (a - b) > EPSILON;
}

export function gte(a: number, b: number): boolean {
  return (a - b) > -EPSILON;
}
