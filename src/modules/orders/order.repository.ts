import { injectable } from 'inversify'
import { EntityRepository, Repository } from 'typeorm'
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

  async getOrders(pageNo: number, type: OrderType) {
    return this.find({
      skip: pageNo * this.#pageSize,
      take: this.#pageSize,
      order: {
        price: type === OrderType.Bid ? 'DESC' : 'ASC',
        blockNumber: 'DESC',
      },
      where: {
        type: type,
      },
    })
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
      price: Number(cell.price),
    })
}

export default OrderRepository
