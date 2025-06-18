import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { ExchangeConfig, ExchangeMessage } from './types';
import { PATHS } from '@/config';

export abstract class ExchangeRecorder {
  protected buffer: ExchangeMessage[] = [];
  protected isRecording = true;
  protected startTime: number;
  protected config: ExchangeConfig;
  protected dataDir: string;
  private rl: readline.Interface;
  private lastStatusUpdate: number = 0;
  private readonly STATUS_UPDATE_INTERVAL = 100; // 0.1 seconds
  private spinnerIndex = 0;
  private readonly SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private bufferSize: number = 0;
  protected fileCounter: number = 1;
  private totalMessages: number = 0;
  private totalSize: number = 0;

  constructor(config: ExchangeConfig, dataDir?: string) {
    this.config = config;
    this.startTime = Date.now();
    this.dataDir = dataDir || path.join(PATHS.DATA, config.exchange.toLowerCase(), config.pair);
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  protected setupKeyboardControls() {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      const key = data.toString().toLowerCase();
      if (key === 'w') {
        console.log('Saving and quitting...');
        this.isRecording = false;
        this.saveData();
        this.cleanup();
      } else if (key === 'q') {
        console.log('Quitting without saving...');
        this.isRecording = false;
        this.cleanup();
      }
    });
  }

  protected cleanup() {
    process.stdin.setRawMode(false);
    this.rl.close();
    process.exit(0);
  }

  protected formatSize(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${bytes}B`;
  }

  protected updateStatus() {
    const now = Date.now();
    if (now - this.lastStatusUpdate < this.STATUS_UPDATE_INTERVAL) return;
    
    const elapsedMs = now - this.startTime;
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
    const messageCount = this.totalMessages + this.buffer.length;
    const totalBytes = this.totalSize + this.bufferSize;
    const formattedSize = this.formatSize(totalBytes);
    
    const spinner = this.SPINNER[this.spinnerIndex];
    this.spinnerIndex = (this.spinnerIndex + 1) % this.SPINNER.length;
    
    process.stdout.write(`\r${spinner} ${messageCount} messages, ${elapsedMinutes}m${elapsedSeconds}s elapsed, ~${formattedSize} (${totalBytes} bytes)`);
    this.lastStatusUpdate = now;
  }

  protected saveData() {
    if (this.buffer.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const dataStr = this.buffer.map(msg => JSON.stringify(msg)).join('\n');
    const size = this.formatSize(dataStr.length);
    const filename = `${timestamp}-${size}-${this.fileCounter}.ndjson`;
    const filepath = path.join(this.dataDir, filename);

    fs.writeFileSync(filepath, dataStr);
    this.totalMessages += this.buffer.length;
    this.totalSize += this.bufferSize;
    this.buffer = [];
    this.bufferSize = 0;
    this.fileCounter++;
  }

  protected addMessage(message: ExchangeMessage) {
    this.buffer.push(message);
    this.bufferSize += JSON.stringify(message).length;
    this.updateStatus();
    if (this.bufferSize >= this.config.fileSizeBytes) {
      this.saveData();
    }
  }

  abstract start(): Promise<void>;
} 