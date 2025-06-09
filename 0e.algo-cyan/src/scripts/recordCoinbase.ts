import { CoinbaseRecorder } from '@/lib/exchange/coinbase/recorder';
import { ExchangeConfig } from '@/lib/base/recorder/types';
import { COINBASE_CHANNELS, CoinbaseChannel } from '@/lib/exchange/coinbase/types';

const DEFAULT_CONFIG: ExchangeConfig = {
  exchange: 'Coinbase',
  channels: ['level2', 'market_trades'],
  pair: 'BTC-USD',
  maxDuration: -1
};

// Parse command line arguments
const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Channels are required. Usage: node recordCoinbase.ts <channel1,channel2,...> [pair] [minutes]');
  console.error(`Available channels: ${Object.keys(COINBASE_CHANNELS).join(', ')}`);
  process.exit(1);
}

const channels = args[0].split(',') as CoinbaseChannel[];
const invalidChannels = channels.filter(channel => !Object.keys(COINBASE_CHANNELS).includes(channel));
if (invalidChannels.length > 0) {
  console.error(`Invalid channels: ${invalidChannels.join(', ')}. Use one of: ${Object.keys(COINBASE_CHANNELS).join(', ')}`);
  process.exit(1);
}

const config: ExchangeConfig = {
  ...DEFAULT_CONFIG,
  channels,
  pair: args[1] || DEFAULT_CONFIG.pair,
  maxDuration: args[2] ? parseInt(args[2]) * 60 * 1000 : DEFAULT_CONFIG.maxDuration
};

console.log(`Recording ${channels.join(', ')} for ${config.pair}`);
console.log('Press "w" to save and quit, "q" to quit without saving');

const recorder = new CoinbaseRecorder(config);
recorder.start(); 