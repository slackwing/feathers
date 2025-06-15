import { Account } from './Account';
import { PubSub, ReadOnlyPubSub } from '@/lib/infra/PubSub';
import { Order } from './Order';
import { World_SimpleL2PaperMatching } from '@/lib/derived/World_SimpleL2PaperMatching';
import { MRStrat_Stochastic } from '@/lib/derived/MRStrat_Stochastic';
import { IntelligenceV1 } from './Intelligence';
import { AssetPair } from './Asset';
import { Quotes } from './Quotes';
import { I1SQ_ } from '@/lib/derived/Intervals';

export class Run<A extends AssetPair> {
  public readonly paperAccount: Account;
  public readonly paperFeed: PubSub<Order<A>>;
  public xWorld: World_SimpleL2PaperMatching<A> | null;
  public mrStrat: MRStrat_Stochastic<A, typeof I1SQ_> | null;
  public intelligenceFeed: ReadOnlyPubSub<IntelligenceV1> | null;
  public readonly params: {
    stochasticParams: { kPeriod: number; dPeriod: number; slowingPeriod: number };
    strategyParams: { threshold: number };
  };
  public readonly initialValue: number;
  public netCapitalExposure: number;
  public maxNetCapitalExposure: number;

  constructor(
    paperAccount: Account,
    params: {
      stochasticParams: { kPeriod: number; dPeriod: number; slowingPeriod: number };
      strategyParams: { threshold: number };
    },
    quotes: Quotes
  ) {
    this.paperAccount = paperAccount;
    this.paperFeed = new PubSub<Order<A>>();
    this.xWorld = null;
    this.mrStrat = null;
    this.intelligenceFeed = null;
    this.params = params;
    this.initialValue = paperAccount.computeTotalValue(quotes);
    this.netCapitalExposure = 0.0;
    this.maxNetCapitalExposure = 0.0;
  }
} 