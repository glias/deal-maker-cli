import { Connection, createConnection } from 'typeorm'
import OrdersService from '.'
import OrderRepository from './order.repository'
import { OrderStatus, OrderType } from './order.entity'

describe('Test orders service', () => {
  let connection: Connection
  let ordersService: OrdersService
  let orderRepository: OrderRepository

  const CELLS = {
    bid: {
      cell_output: {
        capacity: '0x12a05f2000',
        lock: {
          code_hash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
          hash_type: 'data',
          args: '0x688327ab52c054a99b30f2287de0f5ee67805ded',
        },
        type: {
          code_hash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
          hash_type: 'type',
          args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
        },
      },
      out_point: {
        tx_hash: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee',
        index: '0x0',
      },
      block_hash: '0xaaeee4a93a1d79ccdf50f9e2e6c688f9d935bb8c21aeaf2c09508f8070b1bd89',
      block_number: '0x13',
      data:
        '0x00743ba40b000000000000000000000000e40b5402000000000000000000000000c817a804000000000000000000000000743ba40b00000000',
    },
    ask: {
      cell_output: {
        capacity: '0x12a05f2000',
        lock: {
          code_hash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
          hash_type: 'data',
          args: '0x688327ab52c054a99b30f2287de0f5ee67805ded',
        },
        type: {
          code_hash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
          hash_type: 'type',
          args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
        },
      },
      out_point: {
        tx_hash: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee',
        index: '0x1',
      },
      block_hash: '0xaaeee4a93a1d79ccdf50f9e2e6c688f9d935bb8c21aeaf2c09508f8070b1bd89',
      block_number: '0x13',
      data:
        '0x00743ba40b000000000000000000000000e40b5402000000000000000000000000c817a804000000000000000000000000743ba40b00000001',
    },
  }

  beforeEach(async () => {
    connection = await createConnection('test')
    ordersService = new OrdersService()
    orderRepository = connection.getCustomRepository(OrderRepository)
    await ordersService.clear()
  })

  afterEach(async () => {
    await connection.close()
  })

  it('match orders', () => {
    expect(() => ordersService.match()).not.toThrow()
  })

  it('should save order', async () => {
    const cellToSave: any = CELLS.ask
    const saved = await ordersService.saveOrder(cellToSave)
    expect(saved).toEqual({
      id: `${cellToSave.out_point.tx_hash}-${cellToSave.out_point.index}`,
      tokenId: cellToSave.cell_output.type.args,
      blockNumber: +cellToSave.block_number,
      price: 50000000000,
      status: OrderStatus.Available,
      type: OrderType.Ask,
      output: JSON.stringify(cellToSave.cell_output),
    })
  })
  it('should remove order', async () => {
    const saved = await ordersService.saveOrder(CELLS.ask as any)
    let count = await orderRepository.count()
    expect(count).toBe(1)
    await ordersService.removeOrder(saved.id)
    count = await orderRepository.count()
    expect(count).toBe(0)
  })
  it('should change order status', async () => {
    let saved = await ordersService.saveOrder(CELLS.ask as any)
    expect(saved.status).toBe(OrderStatus.Available)
    await ordersService.changeOrderStatus(saved.id, OrderStatus.Pending)
    saved = await orderRepository.findOne(saved.id)
    expect(saved.status).toBe(OrderStatus.Pending)
  })

  it('should get ask orders', async () => {
    let askOrders = await ordersService.getAskOrders()
    expect(askOrders.length).toBe(0)
    await ordersService.saveOrder(CELLS.ask as any)
    askOrders = await ordersService.getAskOrders()
    expect(askOrders.length).toBe(1)
  })

  it('should get bid orders', async () => {
    let bidOrders = await ordersService.getBidOrders()
    expect(bidOrders.length).toBe(0)
    await ordersService.saveOrder(CELLS.bid as any)
    bidOrders = await ordersService.getBidOrders()
    expect(bidOrders.length).toBe(1)
  })

  it('should clear orders', async () => {
    await ordersService.saveOrder(CELLS.ask as any)
    await ordersService.saveOrder(CELLS.bid as any)
    let count = await orderRepository.count()
    expect(count).toBe(2)
    await ordersService.clear()
    count = await orderRepository.count()
    expect(count).toBe(0)
  })
})
