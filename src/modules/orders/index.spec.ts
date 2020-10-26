import { Connection, createConnection } from 'typeorm'
import OrdersService from '.'
import OrderRepository from './order.repository'
import DealRepository from './deal.repository'
import { OrderType } from './order.entity'
import { DealStatus } from './deal.entity'
import {
  bidCell,
  askCell,
  doneDeal,
  pendingDeal,
  askOrderList1,
  bidOrderList1,
  bidOrderList2,
  bidOrderList3,
} from '../../mock'
import { ADDRGETNETWORKPARAMS } from 'dns'

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

  describe('Test orders', () => {
    it.only('fully match after all order empty', async () => {
      expect(() => ordersService.match(askOrderList1, bidOrderList1)).not.toThrow()
    })

    it('partly match after all order empty', async () => {
      expect(() => ordersService.match(askOrderList1, bidOrderList2)).not.toThrow()
    })

    it('partly match after ask order remaining and bid order empty', async () => {
      expect(() => ordersService.match(askOrderList1, bidOrderList3)).not.toThrow()
    })
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
    it('should save deal', async () => {
      await ordersService.saveDeal(pendingDeal)
      const count = await dealRepository.count()
      expect(count).toBe(1)
    })

    it('should update deal status', async () => {
      let saved = await ordersService.saveDeal(pendingDeal)
      expect(saved.status).toBe(DealStatus.Pending)
      await ordersService.updateDealStatus(saved.txHash, DealStatus.Done)
      saved = await dealRepository.findOne(saved.txHash)
      expect(saved.status).toBe(DealStatus.Done)
    })
    it('should remove deal', async () => {
      const saved = await ordersService.saveDeal(pendingDeal)
      let count = await dealRepository.count()
      expect(count).toBe(1)
      await ordersService.removeDeal(saved.txHash)
      count = await dealRepository.count()
      expect(count).toBe(0)
    })

    it('should deals', async () => {
      let deals = await ordersService.getDeals(0)
      expect(deals).toHaveLength(0)
      await ordersService.saveDeal(pendingDeal)
      await ordersService.saveDeal(doneDeal)
      deals = await ordersService.getDeals(0)
      expect(deals).toHaveLength(2)
    })
    it('should get pending deals', async () => {
      let pendingDeals = await ordersService.getPendingDeals()
      expect(pendingDeals).toHaveLength(0)
      await ordersService.saveDeal(pendingDeal)
      pendingDeals = await ordersService.getPendingDeals()
      expect(pendingDeals).toHaveLength(1)
    })
  })
})
