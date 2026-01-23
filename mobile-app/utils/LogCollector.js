/**
 * LogCollector - Captures console logs for in-app viewing and remote debugging
 *
 * This utility intercepts console.log, console.error, console.warn calls
 * and stores them in memory so they can be viewed in a debug screen or sent to server.
 */

class LogCollector {
  constructor() {
    this.logs = [];
    this.maxLogs = 500; // Keep last 500 logs
    this.listeners = [];
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
    };
    this.initialize();
  }

  initialize() {
    // Intercept console.log
    console.log = (...args) => {
      this.addLog('log', args);
      this.originalConsole.log(...args);
    };

    // Intercept console.error
    console.error = (...args) => {
      this.addLog('error', args);
      this.originalConsole.error(...args);
    };

    // Intercept console.warn
    console.warn = (...args) => {
      this.addLog('warn', args);
      this.originalConsole.warn(...args);
    };

    // Intercept console.info
    console.info = (...args) => {
      this.addLog('info', args);
      this.originalConsole.info(...args);
    };
  }

  addLog(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const logEntry = {
      timestamp,
      level,
      message,
    };

    this.logs.push(logEntry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(logEntry));
  }

  getLogs() {
    return this.logs;
  }

  getLogsAsText() {
    return this.logs.map(log =>
      `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.level.toUpperCase()}: ${log.message}`
    ).join('\n');
  }

  getLogsFiltered(filter) {
    if (!filter) return this.logs;

    const lowerFilter = filter.toLowerCase();
    return this.logs.filter(log =>
      log.message.toLowerCase().includes(lowerFilter) ||
      log.level.toLowerCase().includes(lowerFilter)
    );
  }

  clearLogs() {
    this.logs = [];
    this.notifyListeners();
  }

  onLogAdded(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(null));
  }

  // Export logs as a text file content
  exportLogs() {
    const header = `AwayKey App Logs - Exported at ${new Date().toLocaleString()}\n${'='.repeat(60)}\n\n`;
    return header + this.getLogsAsText();
  }
}

// Create singleton instance
const logCollector = new LogCollector();

export default logCollector;
