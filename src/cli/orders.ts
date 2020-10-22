import DealMaker from '..'
import { OrderDto } from '../modules/orders/order.dto'
import { logger } from '../utils'

const formatOrder = (order?: OrderDto) => {
  return `| ${order?.price.toString().padEnd(20)} ${order?.blockNumber.toString().padEnd(10)}|`
}
const header = () => {
  const headers = `| ${'Ask Price'.padEnd(21)}${'Height'.padEnd(10)}|| ${'Bid Price'.padEnd(21)}${'Height'.padEnd(10)}|`
  const line = `|${'-'.repeat(headers.length / 2 - 2)}|`.repeat(2)
  return `\n${line}\n${headers}\n${line}`
}

const getOrders = async () => {
  const dealMaker = new DealMaker()
  const orders = await dealMaker.getOrders()
  let body = '\n'
  const count = Math.max(orders.asks.length, orders.bids.length)
  for (let i = 0; i < count; i++) {
    body += formatOrder(orders.asks[i]) + formatOrder(orders.bids[i]) + '\n'
  }
  return header() + body
}

const printOrders = async () => {
  const orders = await getOrders()
  logger.info(orders)
}
export default {
  cmd: 'orders',
  desc: 'get orders',
  exec: printOrders,
}
