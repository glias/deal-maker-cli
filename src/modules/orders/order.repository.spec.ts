import { createConnection, getConnection } from 'typeorm'
import OrderRepository from './order.repository'
import { OrderType } from './order.entity'
import { parseOrderCell } from '../../utils/parser'

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
  beforeEach(async () => {
    await orderRepository.clear()
  })
  const ORDERS: Array<ReturnType<typeof parseOrderCell>> = [
    {
      id: 'id_ask_low_price',
      tokenId: 'token_id_ask',
      blockNumber: 1,
      type: '00',
      price: BigInt(123),
      output: {
        capacity: 'capacity_ask',
        lock: { code_hash: 'code_hash_ask', hash_type: 'hash_type_ask' as any, args: 'args_ask' },
        type: { code_hash: 'code_hash_ask', hash_type: 'hash_type_ask' as any, args: 'args_ask' },
      },
    },
    {
      id: 'id_ask_high_price',
      tokenId: 'token_id_ask',
      blockNumber: 1,
      type: '00',
      price: BigInt(321),
      output: {
        capacity: 'capacity_ask',
        lock: { code_hash: 'code_hash_ask', hash_type: 'hash_type_ask' as any, args: 'args_ask' },
        type: { code_hash: 'code_hash_ask', hash_type: 'hash_type_ask' as any, args: 'args_ask' },
      },
    },
    {
      id: 'id_bid_low_price',
      tokenId: 'token_id_bid',
      blockNumber: 1,
      type: '01',
      price: BigInt(123),
      output: {
        capacity: 'capacity_bid',
        lock: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
        type: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
      },
    },
    {
      id: 'id_bid_high_price',
      tokenId: 'token_id_bid',
      blockNumber: 1,
      type: '01',
      price: BigInt(321),
      output: {
        capacity: 'capacity_bid',
        lock: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
        type: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
      },
    },
  ]

  it('save order', async () => {
    let count = await orderRepository.count()
    expect(count).toBe(0)
    await orderRepository.saveOrder(ORDERS[0])
    count = await orderRepository.count()
    expect(count).toBe(1)
  })

  it('remove order', async () => {
    await orderRepository.saveOrder(ORDERS[0])
    let count = await orderRepository.count()
    expect(count).toBe(1)
    const saved = await orderRepository.findOne()
    await orderRepository.removeOrder(saved.id)
    count = await orderRepository.count()
    expect(count).toBe(0)
  })

  it('get orders', async () => {
    for (let i = 0; i < ORDERS.length; i++) {
      await orderRepository.saveOrder(ORDERS[i])
    }
    const askOrders = await orderRepository.getOrders(0, OrderType.Ask)
    const bidOrders = await orderRepository.getOrders(0, OrderType.Bid)
    expect(askOrders).toHaveLength(2)
    expect(bidOrders).toHaveLength(2)
    expect(askOrders[0].price).toBeLessThan(askOrders[1].price)
    expect(bidOrders[0].price).toBeGreaterThan(bidOrders[1].price)
  })
})
