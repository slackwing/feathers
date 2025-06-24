export interface ParamDefaults<T> {
  readonly defaultValue: T;
  readonly defaultVariationValues: T[];
}

export abstract class Param<T> {
  public readonly name: string;
  public readonly value: T | null;

  constructor(value: T | null, name: string) {
    this.name = name;
    this.value = value;
  }
}

export interface StochasticWindows {
  kPeriod: number;
  dPeriod: number;
  sPeriod: number;
}

export class StochasticWindowParams extends Param<StochasticWindows> {
  public static readonly defaultValue: StochasticWindows = {kPeriod: 14, dPeriod: 3, sPeriod: 3};
  public static readonly defaultVariationValues: StochasticWindows[] = [
    { kPeriod: 14, dPeriod: 3, sPeriod: 3 }, // Standard; length 18.
    { kPeriod: 14*5, dPeriod: 3*5, sPeriod: 3*5 }, // 5x Standard; length 98.
    { kPeriod: 14*10, dPeriod: 3*10, sPeriod: 3*10 }, // 10x Standard; length 198.
    { kPeriod: 14*15, dPeriod: 3*15, sPeriod: 3*15 }, // 15x Standard; length 298.
  ];
  constructor(value: StochasticWindows) {
    super(value, 'StochasticWindowParams');
  }
}

export class StochasticThresholdParam extends Param<number> {
  public static readonly defaultValue: number = 20;
  public static readonly defaultVariationValues: number[] = [30, 20, 15, 10];
  constructor(value: number) {
    super(value, 'StochasticThresholdParam');
  }
}

export class FixedQuantityParam extends Param<number> {
  public static readonly defaultValue: number = 100;
  public static readonly defaultVariationValues: number[] = [100];
  constructor(value: number) {
    super(value, 'FixedQuantityParam');
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ParamSet<T> = Param<T>[];

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Variation = Map<string, Param<any>>;

export type Variations = Variation[];

// TODO(P2): This could use documentation.
export class VariationUtils {
  public static getDefaultValue<T>(paramClass: (new (value: T) => Param<T>) & ParamDefaults<T>): Param<T> {
    return new paramClass(paramClass.defaultValue);
  }
  public static getDefaultVariations<T>(paramClass: (new (value: T) => Param<T>) & ParamDefaults<T>): ParamSet<T> {
    return paramClass.defaultVariationValues.map((value: T) => new paramClass(value));
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