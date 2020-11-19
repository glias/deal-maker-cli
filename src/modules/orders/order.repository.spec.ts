import { createConnection, getConnection } from 'typeorm'
import OrderRepository from './order.repository'
import { OrderType } from './order.entity'
import {
  askOrderWithLowerPrice,
  askOrderWithHigherPrice,
  bidOrderWithHigherPrice,
  bidOrderWithLowerPrice,
  orderWithZeroAmount,
  orderWithWrongType,
  orderWithAskButSudtAmountZero,
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

  describe('save order', () => {
    describe('should save when order is valid', () => {
      it('order with non-zero order amount', async () => {
        let count = await orderRepository.count()
        expect(count).toBe(0)
        await orderRepository.saveOrder(askOrderWithLowerPrice)
        count = await orderRepository.count()
        expect(count).toBe(1)
      })
    })

    describe('should not save when order is invalid', () => {
      let count = 0
      beforeEach(async () => {
        count = 0
        count = await orderRepository.count()
        expect(count).toBe(0)
      })
      afterEach(async () => {
        count = await orderRepository.count()
        expect(count).toBe(0)
      })
      it('order with zero order amount', async () => {
        const res = await orderRepository.saveOrder(orderWithZeroAmount)
        expect(res).toBeNull()
      })

      it('order with invalid lock args', async () => {
        const order = {
          ...askOrderWithLowerPrice,
          output: {
            ...askOrderWithLowerPrice.output,
            lock: {
              ...askOrderWithLowerPrice.output.lock,
              args: '0x0',
            },
          },
        }
        const res = await orderRepository.saveOrder(order)
      })
      it('order without type script', async () => {
        const order = {
          ...askOrderWithLowerPrice,
          output: { ...askOrderWithLowerPrice.output, type: null },
        }
        const res = await orderRepository.saveOrder(order)
      })
      it('order without type args', async () => {
        const order = {
          ...askOrderWithLowerPrice,
          output: {
            ...askOrderWithLowerPrice.output,
            type: {
              ...askOrderWithLowerPrice.output.type!,
              args: null,
            },
          },
        }
        const res = await orderRepository.saveOrder(order)
      })
      it('order with type args outside the whitelist', async () => {
        const order = {
          ...askOrderWithLowerPrice,
          output: {
            ...askOrderWithLowerPrice.output,
            type: {
              ...askOrderWithLowerPrice.output.type!,
              args: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            },
          },
        }
        const res = await orderRepository.saveOrder(order)
      })
      it('order with invalid order type', async () => {
        const order = { ...askOrderWithLowerPrice, type: '02' as any }
        const res = await orderRepository.saveOrder(order)
      })
    })
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

  describe('get orders', () => {
    it('should return all orders', async () => {
      for (const order of [
        askOrderWithHigherPrice,
        askOrderWithLowerPrice,
        bidOrderWithLowerPrice,
        bidOrderWithHigherPrice,
      ]) {
        await orderRepository.saveOrder(order)
      }
      const askOrders = await orderRepository.getOrders(
        0,
        OrderType.Ask,
        [],
        '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
      )
      const bidOrders = await orderRepository.getOrders(
        0,
        OrderType.Bid,
        [],
        '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
      )
      expect(askOrders).toHaveLength(2)
      expect(bidOrders).toHaveLength(2)
      expect(BigInt(askOrders[0].price)).toBeLessThan(BigInt(askOrders[1].price))
      expect(BigInt(bidOrders[0].price)).toBeGreaterThan(BigInt(bidOrders[1].price))
    })

    it('should skip pending orders', async () => {
      await orderRepository.saveOrder(askOrderWithHigherPrice)
      await orderRepository.saveOrder(askOrderWithLowerPrice)

      const askOrders = await orderRepository.getOrders(
        0,
        OrderType.Ask,
        [askOrderWithHigherPrice.id],
        '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
      )
      expect(askOrders).toHaveLength(1)
      expect(askOrders[0].id).toBe(askOrderWithLowerPrice.id)
    })
  })

  describe('flush all orders', () => {
    beforeEach(async () => {
      await orderRepository.saveOrder(askOrderWithHigherPrice)
      await orderRepository.saveOrder(askOrderWithLowerPrice)
    })

    afterEach(async () => {
      await orderRepository.clear()
    })

    it('should flush ask orders with bid orders', async () => {
      let orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([OrderType.Ask, OrderType.Ask])
      await orderRepository.flushAllOrders([bidOrderWithHigherPrice, bidOrderWithLowerPrice])
      orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([OrderType.Bid, OrderType.Bid])
    })

    it('should skip orders which have zero order amount', async () => {
      let orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([OrderType.Ask, OrderType.Ask])
      await orderRepository.flushAllOrders([orderWithZeroAmount])
      orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([])
    })

    it('should skip orders which have wrong type', async () => {
      let orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([OrderType.Ask, OrderType.Ask])
      await orderRepository.flushAllOrders([orderWithWrongType])
      orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([])
    })

    it('should skip orders which is ask but with zero sudt amount', async () => {
      let orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([OrderType.Ask, OrderType.Ask])
      await orderRepository.flushAllOrders([orderWithAskButSudtAmountZero])
      orders = await orderRepository.find()
      expect(orders.map(o => o.type)).toEqual([])
    })
  })
})
