import { injectable } from 'inversify'
import { EntityRepository, Repository, Not, In } from 'typeorm'
import { parseOrderCell } from '../../utils'
import { Order, OrderType } from './order.entity'

@injectable()
@EntityRepository(Order)
class OrderRepository extends Repository<Order> {
  #pageSize = 100
  async saveOrder(cell: ReturnType<typeof parseOrderCell>) {
    return this.save(this.#toCell(cell))
  }

  async removeOrder(id: string) {
    return this.delete(id)
  }

  async getOrders(pageNo: number, type: OrderType, pendingOrderIds: string[] = []) {
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
      },
    }).then(orders => orders.map(o => ({ ...o, price: BigInt(`0x${o.price}`) })))
  }

  async flushAllOrders(cells: Array<ReturnType<typeof parseOrderCell>>) {
    return this.manager.transaction(async txManager => {
      await txManager.clear(Order)
      for (let i = 0; i < cells.length; i++) {
        await txManager.save(this.#toCell(cells[i]))
      }
    })
  }

  #toCell = (cell: ReturnType<typeof parseOrderCell>) =>
    this.create({
      ...cell,
      output: JSON.stringify(cell.output),
      type: cell.type === '00' ? OrderType.Bid : OrderType.Ask,
      price: cell.price.toString(16).padStart(16, '0'),
    })
}

export default OrderRepository
