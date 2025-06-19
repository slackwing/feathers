import { Account } from './Account';
import { PubSub, ReadOnlyPubSub } from '../infra/PubSub';
import { Order } from './Order';
import { AssetPair } from './Asset';
import { World_SimpleL2PaperMatching } from '../derived/World_SimpleL2PaperMatching';
import { MRStrat_Stochastic } from '../derived/MRStrat_Stochastic';
import { IntelligenceV1, IntelligenceV1Type } from './Intelligence';
import { Quotes } from './Quotes';
import { I1SQ_ } from '../derived/Intervals';

export class RunV2<A extends AssetPair> {
  public paperAccount: Account;
  public paperFeed: PubSub<Order<A>>;
  public xWorld: World_SimpleL2PaperMatching<A> | null = null;
  public mrStrat: MRStrat_Stochastic<A, typeof I1SQ_> | null = null;
  public intelligenceFeed: ReadOnlyPubSub<IntelligenceV1> | null = null;
  public params: {
    stochasticParams: {
      kPeriod: number;
      dPeriod: number;
      slowingPeriod: number;
    };
    strategyParams: {
      threshold: number;
    };
  };
  public netCapitalExposure: number = 0.0;
  public maxNetCapitalExposure: number = 0.0;
  public initialValue: number;
  public intelCounts: Map<string, number> = new Map();
  public lastSignalTime: number = 0;
  public timeBetweenSignals: number[] = [];
  public orderSummaries: string[] = [];

  constructor(paperAccount: Account, params: {
    stochasticParams: {
      kPeriod: number;
      dPeriod: number;
      slowingPeriod: number;
    };
    strategyParams: {
      threshold: number;
    };
  }, quotes: Quotes) {
    this.paperAccount = paperAccount;
    this.paperFeed = new PubSub<Order<A>>();
    this.params = params;
    this.initialValue = paperAccount.computeTotalValue(quotes);
  }

  public getSignalCount(): number {
    return this.intelCounts.get(IntelligenceV1Type.SIGNAL) || 0;
  }

  public getAverageTimeBetweenSignals(): number {
    if (this.timeBetweenSignals.length === 0) return 0;
    const sum = this.timeBetweenSignals.reduce((a, b) => a + b, 0);
    return sum / this.timeBetweenSignals.length;
  }

  public getStdDeviationTimeBetweenSignals(): number {
    if (this.timeBetweenSignals.length === 0) return 0;
    const mean = this.getAverageTimeBetweenSignals();
    const squareDiffs = this.timeBetweenSignals.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  public getOversignalCount(): number {
    return this.intelCounts.get(IntelligenceV1Type.OVERSIGNAL) || 0;
  }

  public getPresignalCount(): number {
    return this.intelCounts.get(IntelligenceV1Type.PRESIGNAL) || 0;
  }

  public getOversignalRatio(): number {
    const signalCount = this.getSignalCount();
    if (signalCount === 0) return 0;
    return this.getOversignalCount() / signalCount;
  }
} 