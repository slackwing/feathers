export class Param<T> {
  public readonly name: string;
  public readonly value: T | null;
  public readonly defaultValue: T;
  public readonly defaultVariationValues: T[];

  constructor(value: T | null, name: string, defaultValue: T, defaultVariationValues: T[]) {
    this.name = name;
    this.value = value;
    this.defaultValue = defaultValue;
    this.defaultVariationValues = defaultVariationValues;
  }
}

export interface StochasticWindows {
  kPeriod: number;
  dPeriod: number;
  sPeriod: number;
}

export class StochasticWindowParams extends Param<StochasticWindows> {
  constructor(value: StochasticWindows) {
    super(value, 'StochasticWindowParams', {kPeriod: 14, dPeriod: 3, sPeriod: 3}, [
      { kPeriod: 14, dPeriod: 3, sPeriod: 3 }, // Standard; length 18.
      { kPeriod: 14*5, dPeriod: 3*5, sPeriod: 3*5 }, // 5x Standard; length 98.
      { kPeriod: 14*10, dPeriod: 3*10, sPeriod: 3*10 }, // 10x Standard; length 198.
      { kPeriod: 14*15, dPeriod: 3*15, sPeriod: 3*15 }, // 15x Standard; length 298.
    ]);
  }
}

export class StochasticThresholdParam extends Param<number> {
  constructor(value: number) {
    super(value, 'StochasticThresholdParam', 20, [30, 20, 15, 10]);
  }
}

export class FixedQuantityParam extends Param<number> {
  constructor(value: number) {
    super(value, 'FixedQuantityParam', 100, [100]);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ParamSet<T> = Param<T>[];

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Variation = Map<string, Param<any>>;

export type Variations = Variation[];

export class VariationUtils {
  public static getDefaultVariations<T>(paramClass: new (value: T | null) => Param<T>): ParamSet<T> {
    const defaultInstance = new paramClass(null);
    return defaultInstance.defaultVariationValues.map(value => new paramClass(value));
  }
  public static cross<T, U>(params1: ParamSet<T>, params2: ParamSet<U>): Variation[] {
    return params1.flatMap(p1 => params2.map(p2 => {
      const map = new Map<string, Param<any>>();
      map.set(p1.name, p1);
      map.set(p2.name, p2);
      return map;
    }));
  }
  public static addFixedParam(variations: Variation[], param: Param<any>): Variation[] {
    return variations.map(variation => {
      const newVariation = new Map(variation);
      newVariation.set(param.name, param);
      return newVariation;
    });
  }
}