import { Connection, createConnection } from 'typeorm'
import OrdersService from '.'
import OrderRepository from './order.repository'
import DealRepository from './deal.repository'
import { OrderType } from './order.entity'
import { DealStatus } from './deal.entity'
import { bidCell, askCell } from '../../mock'

describe('Test orders service', () => {
  let connection: Connection
  let ordersService: OrdersService
  let orderRepository: OrderRepository
  let dealRepository: DealRepository

  beforeEach(async () => {
    connection = await createConnection('test')
    ordersService = new OrdersService()
    orderRepository = connection.getCustomRepository(OrderRepository)
    dealRepository = connection.getCustomRepository(DealRepository)
  })

  afterEach(async () => {
    await connection.close()
  })

  it('match orders', () => {
    expect(() => ordersService.match()).not.toThrow()
  })

  describe('Test orders', () => {
    afterEach(async () => {
      await orderRepository.clear()
    })
    it('should save order', async () => {
      const cellToSave = askCell
      const saved = await ordersService.saveOrder(cellToSave)
      expect(saved).toEqual({
        id: `${cellToSave.out_point.tx_hash}-${cellToSave.out_point.index}`,
        tokenId: cellToSave.cell_output.type.args,
        blockNumber: +cellToSave.block_number,
        price: BigInt(50000000000).toString(16).padStart(16, '0'),
        type: OrderType.Ask,
        output: JSON.stringify({ ...cellToSave.cell_output, data: cellToSave.data }),
      })
    })
    it('should remove order', async () => {
      const saved = await ordersService.saveOrder(askCell)
      let count = await orderRepository.count()
      expect(count).toBe(1)
      await ordersService.removeOrder(saved.id)
      count = await orderRepository.count()
      expect(count).toBe(0)
    })

    it('should get ask orders', async () => {
      let askOrders = await ordersService.getAskOrders()
      expect(askOrders).toHaveLength(0)
      await ordersService.saveOrder(askCell)
      askOrders = await ordersService.getAskOrders()
      expect(askOrders).toHaveLength(1)
    })

    it('should get bid orders', async () => {
      let bidOrders = await ordersService.getBidOrders()
      expect(bidOrders).toHaveLength(0)
      await ordersService.saveOrder(bidCell)
      bidOrders = await ordersService.getBidOrders()
      expect(bidOrders).toHaveLength(1)
    })

    it('should flush orders', async () => {
      await ordersService.saveOrder(askCell)
      let orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([OrderType.Ask])
      await ordersService.flushOrders([bidCell])
      orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([OrderType.Bid])
    })

    it('should clear orders', async () => {
      await ordersService.saveOrder(askCell)
      await ordersService.saveOrder(bidCell)
      let count = await orderRepository.count()
      expect(count).toBe(2)
      await ordersService.clearOrders()
      count = await orderRepository.count()
      expect(count).toBe(0)
    })
  })

  describe('Test deals', () => {
    beforeEach(async () => {
      await dealRepository.clear()
    })
    const DEAL = {
      txHash: 'tx_hash',
      orderIds: 'order_ids',
      fee: 'fee',
      status: DealStatus.Pending,
    }
    it('should save deal', async () => {
      await ordersService.saveDeal(DEAL)
      const count = await dealRepository.count()
      expect(count).toBe(1)
    })

    it('should change deal status', async () => {
      let saved = await ordersService.saveDeal(DEAL)
      expect(saved.status).toBe(DealStatus.Pending)
      await ordersService.changeDealStatus(saved.txHash, DealStatus.Done)
      saved = await dealRepository.findOne(saved.txHash)
      expect(saved.status).toBe(DealStatus.Done)
    })
    it('should remove deal', async () => {
      const saved = await ordersService.saveDeal(DEAL)
      let count = await dealRepository.count()
      expect(count).toBe(1)
      await ordersService.removeDeal(saved.txHash)
      count = await dealRepository.count()
      expect(count).toBe(0)
    })
    it('should get pending deals', async () => {
      let pendingDeals = await ordersService.getPendingDeals()
      expect(pendingDeals).toHaveLength(0)
      await ordersService.saveDeal(DEAL)
      pendingDeals = await ordersService.getPendingDeals()
      expect(pendingDeals).toHaveLength(1)
    })
  })
})
