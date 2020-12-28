import { injectable } from 'inversify'
import { EntityRepository, Repository } from 'typeorm'
import rpcResultFormatter from '@nervosnetwork/ckb-sdk-rpc/lib/resultFormatter'
import { parseOrderCell, SUDT_TYPE_ARGS_LIST, logger } from '../../utils'
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
    const order = type === OrderType.Bid ? 'DESC' : 'ASC'
    return this.createQueryBuilder('order')
      .where('order.type = :type', { type })
      .andWhere('order.tokenId = :tokenId', { tokenId: sudtTypeArgs })
      .andWhere('order.id NOT IN (:...ids)', { ids: pendingOrderIds })
      .orderBy('order.priceExponent', order)
      .addOrderBy('order.priceEffect', order)
      .addOrderBy('order.blockNumber', 'DESC')
      .offset(pageNo * this.#pageSize)
      .limit(this.#pageSize)
      .getMany()
      .then(orders =>
        orders.map(o => ({ ...o, price: { effect: BigInt(`0x${o.priceEffect}`), exponent: BigInt(o.priceExponent) } })),
      )
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
          priceEffect: cell.price.effect.toString(16).padStart(16, '0'),
          priceExponent: Number(cell.price.exponent),
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

    try {
      switch (+cell.type) {
        case OrderType.Bid: {
          return false
        }
        case OrderType.Ask: {
          return false
        }
        default: {
          return true
        }
      }
    } catch (err) {
      /* istanbul ignore next */
      logger.warn(`${cell.id}-${err.message}`)
      /* istanbul ignore next */
      return true
    }
  }
}

export default OrderRepository
