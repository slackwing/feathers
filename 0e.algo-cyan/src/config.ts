import * as path from 'path';

// Get project root (2 levels up from src)
export const PROJECT_ROOT = path.resolve(__dirname, '..');

// Default paths relative to project root
export const PATHS = {
  DATA: path.join(PROJECT_ROOT, 'data'),
} as const; 