import { LogEntry } from '../types';

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  log(type: LogEntry['type'], title: string, data: any) {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      title,
      data
    };
    this.logs.unshift(entry);
    this.notify();
  }

  getLogs() {
    return this.logs;
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.logs));
  }

  clear() {
    this.logs = [];
    this.notify();
  }
}

export const logger = new LoggerService();