import { injectable } from 'inversify'
import { getConnection } from 'typeorm'
import type { Cell } from '@ckb-lumos/base'
import OrderRepository from './order.repository'
import DealRepository from './deal.repository'
import { Order, OrderType } from './order.entity'
import { logger, parseOrderCell } from '../../utils'
import { Deal, DealStatus } from './deal.entity'

const logTag = `\x1b[35m[Orders Service]\x1b[0m`

@injectable()
class OrdersService {
  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }

  #orderRepository = getConnection(process.env.NODE_ENV).getCustomRepository(OrderRepository)
  #dealRepository = getConnection(process.env.NODE_ENV).getCustomRepository(DealRepository)
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

  /**
   * @param pageNo start from 0
   */
  public getAskOrders = (pageNo = 0): Promise<Order[]> => {
    return this.#orderRepository.getOrders(pageNo, OrderType.Ask)
  }

  /**
   * @param pageNo start from 0
   */
  public getBidOrders = (pageNo = 0): Promise<Order[]> => {
    return this.#orderRepository.getOrders(pageNo, OrderType.Bid)
  }

  public flushOrders = (cells: Array<Cell>) => {
    return this.#orderRepository.flushAllOrders(cells.map(parseOrderCell))
  }

  public clearOrders = () => {
    return this.#orderRepository.clear()
  }

  public saveDeal = (deal: Omit<Deal, 'createdAt'>) => {
    return this.#dealRepository.saveDeal(deal)
  }

  public changeDealStatus = (txHash: string, status: DealStatus) => {
    return this.#dealRepository.changeDealStatus(txHash, status)
  }

  public removeDeal = (txHash: string) => {
    return this.#dealRepository.removeDeal(txHash)
  }

  public getPendingDeals = () => {
    return this.#dealRepository.getPendingDeals()
  }
}

export default OrdersService
