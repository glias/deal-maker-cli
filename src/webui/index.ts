import http from 'http'
import fs from 'fs'
import path from 'path'
import Io from 'socket.io'
import { logger } from '../utils'
import { Config } from '../modules/config/config.entity'

const logTag = `\x1b[35m[Web UI]\x1b[0m`

type Order = Record<'price' | 'sudtAmount' | 'orderAmount' | 'outPoint' | 'capacity', string>
type Deal = Record<'txHash' | 'fee' | 'status' | 'createdAt', string>

export interface Stat {
  askOrders: Array<Order>
  bidOrders: Array<Order>
  config: Pick<Config, 'keyFile' | 'remoteUrl' | 'feeRate' | 'tokenPairs'>
  deals: Array<Deal>
  syncState: {
    tip: number
  }
  type: string
}

const bootstrap = (port: number, { onConnect, onSetConfig }: Record<'onConnect' | 'onSetConfig', Function>) => {
  const viewContent = fs.readFileSync(path.join(__dirname, '..', '..', 'webui.html'), 'utf-8')
  const server = http.createServer((_, res) => {
    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Length', Buffer.byteLength(viewContent))
    res.end(viewContent)
  })

  const io = Io(server)
  io.on('connect', socket => {
    onConnect()
    socket.on('set-config', (key: string, value: string) => {
      if (process.env.WEB_UI_USER === 'admin') {
        onSetConfig(key, value)
      }
    })
  })

  server.listen(port, () => {
    logger.info(`${logTag}: Web UI starts at ${port}`)
  })

  return {
    stat: (stat: Stat) => io.emit('stat', stat),
  }
}

export default bootstrap
