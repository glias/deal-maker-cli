import { Cell } from '@ckb-lumos/base'
import { logger } from './logger'
import { ORDER_DATA_LENGTH, ORDER_CELL_SIZE, SHANNONS_RATIO, FEE, FEE_RATIO } from './conts'
import { parseOrderCell, getPrice } from './parser'
import { OrderType } from '../modules/orders/order.entity'
const PRICE_RATIO = BigInt(`1${'0'.repeat(20)}`)

const logTag = `\x1b[40m[Validator]\x1b[0m`

export const isCellValid = (cell: Cell) => {
  try {
    if (cell.data?.length !== ORDER_DATA_LENGTH) {
      throw new Error('Invalid data length')
    }
    const { price: p, orderAmount, sudtAmount, output, type } = parseOrderCell(cell)
    const freeCapacity = BigInt(output.capacity) - ORDER_CELL_SIZE * SHANNONS_RATIO
    const price = BigInt(
      getPrice(p).multipliedBy(PRICE_RATIO.toString()).toFormat({ groupSeparator: '', decimalSeparator: '.' }),
    )

    if (+type === OrderType.Bid) {
      const costAmount = orderAmount * price
      if (costAmount + (costAmount * FEE) / (FEE + FEE_RATIO) > freeCapacity * PRICE_RATIO) {
        throw new Error('Order amount is too high')
      }
      if ((orderAmount * price) / PRICE_RATIO === BigInt(0)) {
        throw new Error('Order amount is too low')
      }
      return true
    }
    if (+type === OrderType.Ask) {
      const costAmount = orderAmount * PRICE_RATIO
      if (costAmount + (costAmount * FEE) / (FEE + FEE_RATIO) > sudtAmount * price) {
        throw new Error('Order amount is too high')
      }
      if ((orderAmount * PRICE_RATIO) / price === BigInt(0)) {
        throw new Error('Order amount is too low')
      }
      return true
    }
    throw new Error('Not an bid or ask order')
  } catch (err) {
    logger.warn(`${logTag}: cell ${cell.out_point?.tx_hash}:${cell.out_point?.index} - ${err.message}`)
    return false
  }
}
