import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
  level: isProduction ? 'info' : 'debug',
});
