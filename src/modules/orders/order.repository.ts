import { injectable } from 'inversify'
import { EntityRepository, Repository, Not, In } from 'typeorm'
import { parseOrderCell, SUDT_TYPE_ARGS_LIST, FEE, FEE_RATIO, SHANNONS_RATIO, PRICE_RATIO } from '../../utils'
import { Order, OrderType } from './order.entity'

@injectable()
@EntityRepository(Order)
class OrderRepository extends Repository<Order> {
  #pageSize = 50
  async saveOrder(cell: ReturnType<typeof parseOrderCell>) {
    const c = this.#toCell(cell)
    if (c) {
      return this.save(c)
    }
    return null
  }

  async removeOrder(id: string) {
    return this.delete(id)
  }

  async getOrders(pageNo: number, type: OrderType, pendingOrderIds: string[] = [], sudtTypeArgs: string) {
    return this.find({
      skip: pageNo * this.#pageSize,
      take: this.#pageSize,
      order: {
        price: type === OrderType.Bid ? 'DESC' : 'ASC',
        blockNumber: 'DESC',
      },
      where: {
        type: type,
        id: Not(In(pendingOrderIds)),
        tokenId: sudtTypeArgs,
      },
    }).then(orders => orders.map(o => ({ ...o, price: BigInt(`0x${o.price}`) })))
  }

  async flushAllOrders(cells: Array<ReturnType<typeof parseOrderCell>>) {
    return this.manager.transaction(async txManager => {
      await txManager.clear(Order)
      for (let i = 0; i < cells.length; i++) {
        const c = this.#toCell(cells[i])
        if (c) {
          await txManager.save(c)
        }
      }
    })
  }

  #toCell = (cell: ReturnType<typeof parseOrderCell>) =>
    this.isInvalidOrderCell(cell)
      ? null
      : this.create({
          ...cell,
          output: JSON.stringify(cell.output),
          type: cell.type === '00' ? OrderType.Bid : OrderType.Ask,
          price: cell.price.toString(16).padStart(16, '0'),
        })

  private isInvalidOrderCell(cell: ReturnType<typeof parseOrderCell>) {
    const lockScriptArgsLength = 66
    const smallestCapacity: bigint =
      (cell.orderAmount * cell.price + (cell.orderAmount * cell.price * FEE) / FEE_RATIO) / PRICE_RATIO +
      BigInt(17900000000)
    const askOrderSpendSUDT = cell.orderAmount / ((cell.price * SHANNONS_RATIO) / PRICE_RATIO)
    const smallestSudtOrderAmount: bigint = askOrderSpendSUDT + (askOrderSpendSUDT * FEE) / FEE_RATIO

    if (!cell.orderAmount) {
      return true
    }
    if (cell.sudtAmount == BigInt(0) && cell.type === '01') {
      return true
    }
    if (!['00', '01'].includes(cell.type)) {
      return true
    }
    if (cell.type == '00' && BigInt(cell.output.capacity) < smallestCapacity) {
      return true
    }
    if (cell.type == '01' && cell.orderAmount < smallestSudtOrderAmount) {
      return true
    }
    if (!(cell.output.lock.args.length === lockScriptArgsLength)) {
      return true
    }
    if (cell.output.type?.args == undefined || !SUDT_TYPE_ARGS_LIST.includes(cell.output.type?.args)) {
      return true
    }

    return false
  }
}

export default OrderRepository
