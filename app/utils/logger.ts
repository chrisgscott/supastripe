// Simple logger utility

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

type LogLevel = keyof typeof logLevels;

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  private log(level: LogLevel, message: string, meta?: any) {
    if (logLevels[level] <= logLevels[this.level]) {
      const logMessage = meta ? `${message} ${JSON.stringify(meta)}` : message;
      console[level](logMessage);
    }
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: any) {
    this.log('debug', message, meta);
  }
}

export const logger = new Logger(process.env.LOG_LEVEL as LogLevel || 'info');
