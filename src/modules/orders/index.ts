import { injectable } from 'inversify'
import { getConnection } from 'typeorm'
import type { Cell } from '@ckb-lumos/base'
import OrderRepository from './order.repository'
import { Order, OrderStatus, OrderType } from './order.entity'
import { logger, parseOrderCell } from '../../utils'

const logTag = `\x1b[35m[Orders Service]\x1b[0m`

@injectable()
class OrdersService {
  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }

  #orderRepository = getConnection(process.env.NODE_ENV).getCustomRepository(OrderRepository)
  public match() {
    this.#log(`Match Orders`)
  }

  public saveOrder = (cell: Cell) => {
    const parsed = parseOrderCell(cell)
    return this.#orderRepository.saveOrder(parsed)
  }

  public removeOrder = (id: string) => {
    return this.#orderRepository.removeOrder(id)
  }

  public changeOrderStatus = (id: string, status: OrderStatus) => {
    return this.#orderRepository.changeOrderStatus(id, status)
  }

  /**
   * @param pageNo start from 0
   */
  public getAskOrders(pageNo = 0): Promise<Order[]> {
    return this.#orderRepository.getOrders(pageNo, OrderType.Ask)
  }

  /**
   * @param pageNo start from 0
   */
  public getBidOrders(pageNo = 0): Promise<Order[]> {
    return this.#orderRepository.getOrders(pageNo, OrderType.Bid)
  }

  public clear() {
    return this.#orderRepository.clear()
  }
}

export default OrdersService
