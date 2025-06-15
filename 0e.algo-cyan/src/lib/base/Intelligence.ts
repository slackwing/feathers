export interface Intelligence {
}

export enum IntelligenceV1Type {
  NONE = 'NONE',
  PRESIGNAL = 'PRESIGNAL',
  SIGNAL = 'SIGNAL',
  UNSIGNAL = 'UNSIGNAL',
  OVERSIGNAL = 'OVERSIGNAL',
}

export interface IntelligenceV1 extends Intelligence {
  type: IntelligenceV1Type;
}