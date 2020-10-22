import { createConnection, getConnection } from 'typeorm'
import OrderRepository from './order.repository'
import { OrderType } from './order.entity'
import { parseOrderCell } from '../../utils/parser'
import {
  askOrderWithLowerPrice,
  askOrderWithHigherPrice,
  bidOrderWithHigherPrice,
  bidOrderWithLowerPrice,
} from '../../mock'

describe('Test order repository', () => {
  let orderRepository: OrderRepository
  const CONNECTION_NAME = 'test'

  beforeAll(async () => {
    const connection = await createConnection(CONNECTION_NAME)
    orderRepository = connection.getCustomRepository(OrderRepository)
  })

  afterAll(async () => {
    await getConnection(CONNECTION_NAME).close()
  })

  afterEach(async () => {
    await orderRepository.clear()
  })

  it('save order', async () => {
    let count = await orderRepository.count()
    expect(count).toBe(0)
    await orderRepository.saveOrder(askOrderWithLowerPrice)
    count = await orderRepository.count()
    expect(count).toBe(1)
  })

  it('remove order', async () => {
    await orderRepository.saveOrder(askOrderWithLowerPrice)
    let count = await orderRepository.count()
    expect(count).toBe(1)
    const saved = await orderRepository.findOne()
    await orderRepository.removeOrder(saved.id)
    count = await orderRepository.count()
    expect(count).toBe(0)
  })

  it('get orders', async () => {
    for (const order of [
      askOrderWithHigherPrice,
      askOrderWithLowerPrice,
      bidOrderWithLowerPrice,
      bidOrderWithHigherPrice,
    ]) {
      await orderRepository.saveOrder(order)
    }
    const askOrders = await orderRepository.getOrders(0, OrderType.Ask)
    const bidOrders = await orderRepository.getOrders(0, OrderType.Bid)
    expect(askOrders).toHaveLength(2)
    expect(bidOrders).toHaveLength(2)
    expect(BigInt(askOrders[0].price)).toBeLessThan(BigInt(askOrders[1].price))
    expect(BigInt(bidOrders[0].price)).toBeGreaterThan(BigInt(bidOrders[1].price))
  })

  describe('flush all orders', () => {
    beforeAll(async () => {
      await orderRepository.saveOrder(askOrderWithHigherPrice)
      await orderRepository.saveOrder(askOrderWithLowerPrice)
    })

    it('should flush ask orders with bid orders', async () => {
      let orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([OrderType.Ask, OrderType.Ask])
      await orderRepository.flushAllOrders([bidOrderWithHigherPrice, bidOrderWithLowerPrice])
      orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([OrderType.Bid, OrderType.Bid])
    })
  })
})
