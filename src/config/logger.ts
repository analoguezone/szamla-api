import pino from 'pino';
import { config } from './index';

export const logger = pino({
  level: config.logging.level,
  transport:
    config.logging.format === 'pretty' && config.isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
