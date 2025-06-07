import { CoinbaseRecorder } from '@/lib/exchange/coinbase/recorder';
import { ExchangeConfig } from '@/lib/base/recorder/types';
import { COINBASE_CHANNELS, CoinbaseChannel } from '@/lib/exchange/coinbase/types';

const DEFAULT_CONFIG: ExchangeConfig = {
  exchange: 'Coinbase',
  channel: 'level2',
  pair: 'BTC-USD',
  maxDuration: 30 * 60 * 1000 // 30 minutes in ms
};

// Parse command line arguments
const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Channel is required. Usage: node recordCoinbase.ts <channel> [pair] [duration]');
  console.error(`Available channels: ${Object.keys(COINBASE_CHANNELS).join(', ')}`);
  process.exit(1);
}

const config: ExchangeConfig = {
  ...DEFAULT_CONFIG,
  channel: args[0] as CoinbaseChannel,
  pair: args[1] || DEFAULT_CONFIG.pair,
  maxDuration: parseInt(args[2]) * 60 * 1000 || DEFAULT_CONFIG.maxDuration
};

if (!Object.keys(COINBASE_CHANNELS).includes(config.channel)) {
  console.error(`Invalid channel. Use one of: ${Object.keys(COINBASE_CHANNELS).join(', ')}`);
  process.exit(1);
}

console.log(`Recording ${config.channel} for ${config.pair}`);
console.log('Press "w" to save and quit, "q" to quit without saving');

const recorder = new CoinbaseRecorder(config);
recorder.start(); 