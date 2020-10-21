import { injectable } from 'inversify'
import { EntityRepository, Repository } from 'typeorm'
import { parseOrderCell } from '../../utils/parser'
import { Order, OrderStatus, OrderType } from './order.entity'

@injectable()
@EntityRepository(Order)
class OrderRepository extends Repository<Order> {
  #pageSize = 100
  async saveOrder(cell: ReturnType<typeof parseOrderCell>) {
    const cellToSave = this.create({
      ...cell,
      output: JSON.stringify(cell.output),
      type: cell.type === '00' ? OrderType.Bid : OrderType.Ask,
      price: Number(cell.price),
    })
    return this.save(cellToSave)
  }

  async removeOrder(id: string) {
    return this.delete(id)
  }

  async changeOrderStatus(id: string, status: OrderStatus) {
    return this.update(id, { status })
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
        status: OrderStatus.Available,
      },
    })
  }
}

export default OrderRepository
