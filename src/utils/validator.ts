import { Cell } from '@ckb-lumos/base'
import { logger } from './logger'
import { ORDER_DATA_LENGTH, PRICE_RATIO, ORDER_CELL_SIZE, SHANNONS_RATIO } from './conts'
import { parseOrderCell } from './parser'
import { OrderType } from '../modules/orders/order.entity'

const logTag = `\x1b[40m[Validator]\x1b[0m`

export const isCellValid = (cell: Cell) => {
  try {
    if (cell.data?.length !== ORDER_DATA_LENGTH) {
      throw new Error('Invalid data length')
    }
    const { price, orderAmount, sudtAmount, output, type } = parseOrderCell(cell)
    const capacity = BigInt(output.capacity) - ORDER_CELL_SIZE * SHANNONS_RATIO

    if (+type === OrderType.Bid) {
      if (orderAmount * price > capacity * PRICE_RATIO) {
        throw new Error('Invalid order amount')
      }
      return true
    }
    if (+type === OrderType.Ask) {
      if (orderAmount * PRICE_RATIO > sudtAmount * price) {
        throw new Error('Invalid order amount')
      }
      return true
    }
    throw new Error('Not an bid or ask order')
  } catch (err) {
    logger.warn(`${logTag}: cell ${cell.out_point?.tx_hash}:${cell.out_point?.index} - ${err.message}`)
    return false
  }
}
