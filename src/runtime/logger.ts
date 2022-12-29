export enum LogLevel {
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
  event = 5,
}

export default class Logger {
  private logLevel: LogLevel;
  private prefixes = {
    debug: "debug -",
    info: "info -",
    warn: "warn -",
    error: "error -",
    event: "event -",
  };

  constructor(logLevel: LogLevel) {
    this.logLevel = logLevel;
  }

  debug(...message: unknown[]) {
    if (this.logLevel >= LogLevel.debug) {
      console.log(this.prefixes.debug, ...message);
    }
  }

  info(...message: unknown[]) {
    if (this.logLevel >= LogLevel.info) {
      console.log(this.prefixes.info, ...message);
    }
  }

  error(...message: unknown[]) {
    if (this.logLevel >= LogLevel.error) {
      console.log(this.prefixes.error, ...message);
    }
  }

  warn(...message: unknown[]) {
    if (this.logLevel >= LogLevel.warn) {
      console.log(this.prefixes.warn, ...message);
    }
  }

  event(...message: unknown[]) {
    if (this.logLevel >= LogLevel.warn) {
      console.log(this.prefixes.event, ...message);
    }
  }
}
