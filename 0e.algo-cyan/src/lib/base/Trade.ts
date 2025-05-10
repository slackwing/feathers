import { Side } from './Order';

export class Trade {
  constructor(
    public readonly side: Side,
    public readonly price: number,
    public readonly quantity: number,
    public readonly timestamp: number
  ) {}
}
