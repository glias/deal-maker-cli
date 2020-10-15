import winston, { format, transports } from 'winston'

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: format.combine(format.colorize(), format.simple()),
  transports: [new transports.Console(), new transports.File({ filename: 'error.log', level: 'error' })],
})
