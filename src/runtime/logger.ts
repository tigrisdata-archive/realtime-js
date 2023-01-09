/**
 * Copyright 2023 Tigris Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
