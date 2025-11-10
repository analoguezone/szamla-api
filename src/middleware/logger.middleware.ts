import pinoHttp from 'pino-http';
import { logger } from '../config/logger';
import { config } from '../config';

export const loggerMiddleware = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => {
      // Don't log health check requests in production
      return config.isProduction && req.url === '/health';
    },
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
