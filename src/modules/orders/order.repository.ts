import { injectable } from 'inversify'
import { EntityRepository, Repository, Not, In } from 'typeorm'
import rpcResultFormatter from '@nervosnetwork/ckb-sdk-rpc/lib/resultFormatter'
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
          output: JSON.stringify({
            ...cell.output,
            lock: rpcResultFormatter.toScript(cell.output.lock),
            type: cell.output.type && rpcResultFormatter.toScript(cell.output.type),
          }),
          type: cell.type === '00' ? OrderType.Bid : OrderType.Ask,
          price: cell.price.toString(16).padStart(32, '0'),
        })

  private isInvalidOrderCell(cell: ReturnType<typeof parseOrderCell>) {
    if (!cell.orderAmount) {
      return true
    }

    const LOCK_SCRIPT_ARGS_LENGTH = 66
    if (cell.output.lock.args.length !== LOCK_SCRIPT_ARGS_LENGTH) {
      return true
    }

    if (!SUDT_TYPE_ARGS_LIST.includes(cell.output.type?.args ?? '')) {
      return true
    }

    // TODO get min capacity and get min sudt amount
    switch (+cell.type) {
      case OrderType.Bid: {
        const MIN_SHANNONS = BigInt(17_900_000_000)
        const minCapacity =
          (cell.orderAmount * cell.price + (cell.orderAmount * cell.price * FEE) / FEE_RATIO) / PRICE_RATIO +
          MIN_SHANNONS

        return BigInt(cell.output.capacity) < minCapacity
      }
      case OrderType.Ask: {
        if (!cell.sudtAmount) {
          return true
        }
        const askOrderSpendSUDT = (cell.orderAmount * SHANNONS_RATIO) / ((cell.price * SHANNONS_RATIO) / PRICE_RATIO)
        const minSudtOrderAmount = askOrderSpendSUDT + (askOrderSpendSUDT * FEE) / FEE_RATIO
        return cell.sudtAmount < minSudtOrderAmount
      }
      default: {
        return true
      }
    }
  }
}

export default OrderRepository
