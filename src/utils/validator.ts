import { Cell } from '@ckb-lumos/base'
import BigNumber from 'bignumber.js'
import { logger } from './logger'
import { ORDER_DATA_LENGTH, ORDER_CELL_SIZE, SHANNONS_RATIO, FEE, FEE_RATIO } from './conts'
import { parseOrderCell, getPrice } from './parser'
import { OrderType } from '../modules/orders/order.entity'

const logTag = `\x1b[40m[Validator]\x1b[0m`

export const isCellValid = (cell: Cell) => {
  const orderCellSize = new BigNumber(ORDER_CELL_SIZE).multipliedBy(new BigNumber(SHANNONS_RATIO))
  try {
    if (cell.data?.length !== ORDER_DATA_LENGTH) {
      throw new Error('Invalid data length')
    }
    const parsed = parseOrderCell(cell)
    const freeCapacity = new BigNumber(parsed.output.capacity).minus(orderCellSize)
    const price = getPrice(parsed.price)
    const orderAmount = new BigNumber(parsed.orderAmount.toString())
    const sudtAmount = new BigNumber(parsed.sudtAmount.toString())
    const type = parsed.type

    const netRatio = new BigNumber(`${(FEE_RATIO - FEE) / FEE_RATIO}`)
    switch (+type) {
      case OrderType.Bid: {
        /**
         * bid order cost_ckb = (order_sudt * price)
         * require cost_ckb  <= balance_ckb * 0.997
         */
        const costAmount = orderAmount.multipliedBy(price).integerValue(BigNumber.ROUND_DOWN)
        if (costAmount.isEqualTo(0)) {
          throw new Error('Order amount is too low')
        }
        if (costAmount.isGreaterThan(freeCapacity.multipliedBy(netRatio))) {
          throw new Error('Order amount is too high')
        }
        return true
      }
      case OrderType.Ask: {
        /**
         * ask bid cost_sudt = order_ckb / price
         * require cost_sudt <= balance_sudt * 0.997
         */
        const costAmount = orderAmount.div(price).integerValue(BigNumber.ROUND_DOWN)
        if (costAmount.isEqualTo(0)) {
          throw new Error('Order amount is too low')
        }
        if (costAmount.isGreaterThan(sudtAmount.multipliedBy(netRatio))) {
          throw new Error('Order amount is too high')
        }
        return true
      }
      default: {
        throw new Error('Not an bid or ask order')
      }
    }
  } catch (err) {
    logger.warn(`${logTag}: cell ${cell.out_point?.tx_hash}:${cell.out_point?.index} - ${err.message}`)
    return false
  }
}
