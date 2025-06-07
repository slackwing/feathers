import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { ExchangeConfig, ExchangeMessage } from './types';
import { PATHS } from '@/config';

export abstract class ExchangeRecorder {
  protected buffer: ExchangeMessage[] = [];
  protected isRecording = true;
  protected shouldSave = false;
  protected startTime: number;
  protected config: ExchangeConfig;
  protected dataDir: string;
  private rl: readline.Interface;
  private lastStatusUpdate: number = 0;
  private readonly STATUS_UPDATE_INTERVAL = 100; // 0.1 seconds
  private spinnerIndex = 0;
  private readonly SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

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
        this.shouldSave = true;
        this.saveData();
        this.cleanup();
      } else if (key === 'q') {
        console.log('Quitting without saving...');
        this.isRecording = false;
        this.shouldSave = false;
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
    const messageCount = this.buffer.length;
    const rawSize = JSON.stringify(this.buffer).length;
    const totalSize = this.formatSize(rawSize);
    
    const spinner = this.SPINNER[this.spinnerIndex];
    this.spinnerIndex = (this.spinnerIndex + 1) % this.SPINNER.length;
    
    process.stdout.write(`\r${spinner} ${messageCount} messages, ${elapsedMinutes}m${elapsedSeconds}s elapsed, ~${totalSize} (${rawSize} bytes)`);
    this.lastStatusUpdate = now;
  }

  protected saveData() {
    if (!this.shouldSave || this.buffer.length === 0) return;

    const timestamp = new Date(this.startTime).toISOString().replace(/[-:.]/g, '');
    const dataStr = JSON.stringify(this.buffer);
    const size = this.formatSize(dataStr.length);
    const filename = `${timestamp}-${size}.json`;
    const filepath = path.join(this.dataDir, filename);
    const latestPath = path.join(this.dataDir, 'latest.json');

    fs.writeFileSync(filepath, dataStr);
    fs.copyFileSync(filepath, latestPath);
    console.log(`\nSaved ${this.buffer.length} messages to ${filepath}`);
  }

  protected checkMaxDuration() {
    this.updateStatus();
    if (Date.now() - this.startTime >= this.config.maxDuration) {
      this.isRecording = false;
      this.shouldSave = true;
      this.saveData();
      this.cleanup();
    }
  }

  abstract start(): Promise<void>;
} 