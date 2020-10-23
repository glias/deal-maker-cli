import http from 'http'
import fs from 'fs'
import path from 'path'
import Io from 'socket.io'
import { WEB_UI_PORT, logger } from '../utils'
import { Config } from '../modules/config/config.entity'

const logTag = `\x1b[35m[Web UI]\x1b[0m`

type Order = Record<'price' | 'blockNumber' | 'sudtAmount' | 'orderAmount' | 'outPoint' | 'capacity', string>

export interface Stat {
  askOrders: Array<Order>
  bidOrders: Array<Order>
  config: Pick<Config, 'keyFile' | 'remoteUrl' | 'feeRate' | 'tokenPairs'>
}

const bootstrap = (onConnect: Function) => {
  const viewContent = fs.readFileSync(path.join(__dirname, '..', '..', 'webui.html'), 'utf-8')
  const server = http.createServer((_, res) => {
    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Length', Buffer.byteLength(viewContent))
    res.end(viewContent)
  })

  const io = Io(server)
  io.on('connect', () => {
    onConnect()
  })

  server.listen(WEB_UI_PORT, () => {
    logger.info(`${logTag}: Web UI starts at ${WEB_UI_PORT}`)
  })

  return {
    stat: (stat: Stat) => io.emit('stat', stat),
  }
}

export default bootstrap
