import { Connection, createConnection } from 'typeorm'
import OrdersService from '.'
import OrderRepository from './order.repository'
import DealRepository from './deal.repository'
import { OrderType } from './order.entity'
import { DealStatus } from './deal.entity'
import { bidCell, askCell, doneDeal, pendingDeal } from '../../mock'
import { ADDRGETNETWORKPARAMS } from 'dns'
import { OrderDto } from './order.dto'
import { parseOrderData, formatOrderData, readBigUInt128LE } from '../../utils'

describe('Test orders service', () => {
  let connection: Connection
  let ordersService: OrdersService
  let orderRepository: OrderRepository
  let dealRepository: DealRepository
  let rawTx: CKBComponents.RawTransactionToSign

  beforeEach(async () => {
    connection = await createConnection('test')
    ordersService = new OrdersService()
    orderRepository = connection.getCustomRepository(OrderRepository)
    dealRepository = connection.getCustomRepository(DealRepository)
  })

  afterEach(async () => {
    await connection.close()
  })

  describe('Test orders save record', () => {
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
      askOrders = await ordersService.getAskOrders('0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902')
      expect(askOrders).toHaveLength(1)
    })

    it('should get bid orders', async () => {
      let bidOrders = await ordersService.getBidOrders(
        '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
      )
      expect(bidOrders).toHaveLength(0)
      await ordersService.saveOrder(bidCell)
      bidOrders = await ordersService.getBidOrders('0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902')
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
      let deals = await ordersService.getDeals(0, '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902')
      expect(deals).toHaveLength(0)
      await ordersService.saveDeal(pendingDeal)
      await ordersService.saveDeal(doneDeal)
      deals = await ordersService.getDeals(0, '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902')
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

  describe('Test Order Match Method', () => {
    const shannonsRatio = BigInt(100_000_000)
    const dealMakerLock = {
      args: '',
      codeHash: '',
      hashType: 'type',
    }
    const biggestCell = {
      blockHash: '',
      capacity: '0x0',
      lock: dealMakerLock,
      outPoint: '',
      cellbase: true,
      outputDataLen: 10,
      status: '',
      dataHash: '',
    }
    const baseBidOrder: OrderDto = {
      id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
      tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
      type: OrderType.Bid,
      price: BigInt(90_000_000_000),
      blockNumber: 55,
      output: `{"capacity":"0x${(902.7 * 10 * 10 ** 7).toString(
        16,
      )}","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
        BigInt(0),
        BigInt(10_000_000_000),
        BigInt(90_000_000_000),
        '00',
      )}"}`,
    }
    const baseAskOrder: OrderDto = {
      id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
      tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
      type: OrderType.Bid,
      price: BigInt(90_000_000_000),
      blockNumber: 55,
      output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
        BigInt(10_030_000_000),
        BigInt(90_000_000_000),
        BigInt(90_000_000_000),
        '01',
      )}"}`,
    }

    describe('Full match, One ask order One bid order', () => {
      it('return correct capacity and sudt amount', () => {
        // @ts-ignore
        ordersService.startMatchAndReturnOutputs([baseBidOrder], [baseAskOrder])
        // @ts-ignore
        ordersService.pushDealerMakerCellAndData(biggestCell, dealMakerLock)
        // @ts-ignore
        rawTx = ordersService.generateRawTx()
        expect(BigInt(rawTx.outputs[0].capacity)).toEqual((BigInt(90000000000) * BigInt(3)) / BigInt(1000))
        expect(BigInt(rawTx.outputs[1].capacity)).toEqual(BigInt(0))
        expect(BigInt(rawTx.outputs[2].capacity)).toEqual(BigInt(90000000000))
        expect(BigInt('0x' + readBigUInt128LE(rawTx.outputsData[0].slice(2)))).toEqual(BigInt(0.3 * 10 * 10 ** 7))
        expect(parseOrderData(rawTx.outputsData[1]).sudtAmount).toEqual(BigInt(10_000_000_000))
        expect(parseOrderData(rawTx.outputsData[2]).sudtAmount).toEqual(BigInt(0))
      })
    })

    describe('Part match, One ask order One bid order, left bid order', () => {
      const bidOrder_2 = {
        ...baseBidOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x${(1203.6 * 10 * 10 ** 7).toString(
          16,
        )}","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(0),
          BigInt(120 * 10 ** 8),
          BigInt(100_000_000_000),
          '00',
        )}"}`,
      }

      it('return correct capacity and sudt amount', () => {
        // @ts-ignore
        ordersService.startMatchAndReturnOutputs([bidOrder_2], [baseAskOrder])
        // @ts-ignore
        ordersService.pushDealerMakerCellAndData(biggestCell, dealMakerLock)
        // @ts-ignore
        rawTx = ordersService.generateRawTx()
        expect(BigInt(rawTx.outputs[0].capacity)).toEqual(BigInt(270000000))
        expect(BigInt(rawTx.outputs[1].capacity)).toEqual(BigInt(90000000000))
        expect(BigInt(rawTx.outputs[2].capacity)).toEqual(BigInt(30090000000))
        expect(BigInt('0x' + readBigUInt128LE(rawTx.outputsData[0].slice(2)))).toEqual(BigInt(28421052))
        expect(parseOrderData(rawTx.outputsData[1]).sudtAmount).toEqual(BigInt(527894738))
        expect(parseOrderData(rawTx.outputsData[1]).orderAmount).toEqual(BigInt(0))
        expect(parseOrderData(rawTx.outputsData[2]).sudtAmount).toEqual(BigInt(9473684210))
        expect(parseOrderData(rawTx.outputsData[2]).orderAmount).toEqual(BigInt(2526315790))
      })
    })

    describe('Part match, One ask order One bid order, left ask order', () => {
      const bidOrder_3 = {
        ...baseBidOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x${(501.5 * 10 * 10 ** 7).toString(
          16,
        )}","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(0),
          BigInt(50 * 10 ** 8),
          BigInt(100_000_000_000),
          '00',
        )}"}`,
      }

      const askOrder_3 = {
        ...baseAskOrder,
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(13_039_000_000),
          BigInt(1170 * 10 ** 8),
          BigInt(90_000_000_000),
          '00',
        )}"}`,
      }

      it('return correct capacity and sudt amount', () => {
        // @ts-ignore
        ordersService.startMatchAndReturnOutputs([bidOrder_3], [askOrder_3])
        // @ts-ignore
        ordersService.pushDealerMakerCellAndData(biggestCell, dealMakerLock)
        // @ts-ignore
        rawTx = ordersService.generateRawTx()
        expect(BigInt(rawTx.outputs[0].capacity)).toEqual(BigInt(142_500_000))
        expect(BigInt(rawTx.outputs[1].capacity)).toEqual(BigInt(2507_500_000))
        expect(BigInt(rawTx.outputs[2].capacity)).toEqual(BigInt(475 * 10 ** 8))
        expect(BigInt('0x' + readBigUInt128LE(rawTx.outputsData[0].slice(2)))).toEqual(BigInt(15_000_000))
        expect(parseOrderData(rawTx.outputsData[1]).sudtAmount).toEqual(BigInt(50 * 10 ** 8))
        expect(parseOrderData(rawTx.outputsData[1]).orderAmount).toEqual(BigInt(0))
        expect(parseOrderData(rawTx.outputsData[2]).sudtAmount).toEqual(BigInt(8_024_000_000))
        expect(parseOrderData(rawTx.outputsData[2]).orderAmount).toEqual(BigInt(695 * 10 ** 8))
      })
    })

    describe('Full match, One bid order Multiple ask order, no order left', () => {
      const bidOrder_4_1 = {
        ...baseBidOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x${(2206.6 * 10 * 10 ** 7).toString(
          16,
        )}","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(0),
          BigInt(220 * 10 ** 8),
          BigInt(100_000_000_000),
          '00',
        )}"}`,
      }

      const askOrder_4_1 = {
        ...baseAskOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(12_036_000_000),
          BigInt(1200 * 10 ** 8),
          BigInt(100_000_000_000),
          '01',
        )}"}`,
      }
      const askOrder_4_2 = {
        ...baseAskOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(10_030_000_000),
          BigInt(1000 * 10 ** 8),
          BigInt(100_000_000_000),
          '01',
        )}"}`,
      }

      it('return correct capacity and sudt amount', () => {
        // @ts-ignore
        ordersService.startMatchAndReturnOutputs([bidOrder_4_1], [askOrder_4_1, askOrder_4_2])
        // @ts-ignore
        ordersService.pushDealerMakerCellAndData(biggestCell, dealMakerLock)
        // @ts-ignore
        rawTx = ordersService.generateRawTx()
        expect(BigInt(rawTx.outputs[0].capacity)).toEqual(BigInt(660000000))
        expect(BigInt(rawTx.outputs[1].capacity)).toEqual(BigInt(1200 * 10 ** 8))
        expect(BigInt(rawTx.outputs[2].capacity)).toEqual(BigInt(0))
        expect(BigInt(rawTx.outputs[3].capacity)).toEqual(BigInt(1000 * 10 ** 8))
        expect(BigInt('0x' + readBigUInt128LE(rawTx.outputsData[0].slice(2)))).toEqual(BigInt(66_000_000))
        expect(parseOrderData(rawTx.outputsData[1]).sudtAmount).toEqual(BigInt(0))
        expect(parseOrderData(rawTx.outputsData[1]).orderAmount).toEqual(BigInt(0))
        expect(parseOrderData(rawTx.outputsData[2]).sudtAmount).toEqual(BigInt(220 * 10 ** 8))
        expect(parseOrderData(rawTx.outputsData[2]).orderAmount).toEqual(BigInt(0))
        expect(parseOrderData(rawTx.outputsData[3]).sudtAmount).toEqual(BigInt(0))
        expect(parseOrderData(rawTx.outputsData[3]).orderAmount).toEqual(BigInt(0))
      })
    })

    describe('Partly match, One bid order Multiple ask order, left bid order', () => {
      const bidOrder_5_1 = {
        ...baseBidOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x${(2306.6 * 10 * 10 ** 7).toString(
          16,
        )}","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(0),
          BigInt(230 * 10 ** 8),
          BigInt(100_000_000_000),
          '00',
        )}"}`,
      }

      const askOrder_5_1 = {
        ...baseAskOrder,
        price: BigInt(9 * 10 ** 10),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(12_036_000_000),
          BigInt(1080 * 10 ** 8),
          BigInt(90_000_000_000),
          '01',
        )}"}`,
      }
      const askOrder_5_2 = {
        ...baseAskOrder,
        price: BigInt(95 * 10 ** 9),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(10_030_000_000),
          BigInt(950 * 10 ** 8),
          BigInt(95_000_000_000),
          '01',
        )}"}`,
      }

      it('return correct capacity and sudt amount', () => {
        // @ts-ignore
        ordersService.startMatchAndReturnOutputs([bidOrder_5_1], [askOrder_5_1, askOrder_5_2])
        // @ts-ignore
        ordersService.pushDealerMakerCellAndData(biggestCell, dealMakerLock)
        // @ts-ignore
        rawTx = ordersService.generateRawTx()
        expect(BigInt(rawTx.outputs[0].capacity)).toEqual(BigInt(609000000))
        expect(BigInt(rawTx.outputs[1].capacity)).toEqual(BigInt(1080 * 10 ** 8))
        expect(BigInt(rawTx.outputs[2].capacity)).toEqual(BigInt(950 * 10 ** 8))
        expect(BigInt(rawTx.outputs[3].capacity)).toEqual(BigInt(27051000000))
        expect(BigInt('0x' + readBigUInt128LE(rawTx.outputsData[0].slice(2)))).toEqual(BigInt(63336032))
        expect(parseOrderData(rawTx.outputsData[1]).sudtAmount).toEqual(BigInt(633473685))
        expect(parseOrderData(rawTx.outputsData[1]).orderAmount).toEqual(BigInt(0))
        expect(parseOrderData(rawTx.outputsData[2]).sudtAmount).toEqual(BigInt(257179488))
        expect(parseOrderData(rawTx.outputsData[2]).orderAmount).toEqual(BigInt(0))
        expect(parseOrderData(rawTx.outputsData[3]).sudtAmount).toEqual(BigInt(21112010795))
        expect(parseOrderData(rawTx.outputsData[3]).orderAmount).toEqual(BigInt(1887989205))
      })
    })

    describe('Partly match, One bid order Multiple ask order, left ask order', () => {
      const bidOrder_6_1 = {
        ...baseBidOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x${(2206.6 * 10 * 10 ** 7).toString(
          16,
        )}","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(0),
          BigInt(220 * 10 ** 8),
          BigInt(100_000_000_000),
          '00',
        )}"}`,
      }

      const askOrder_6_1 = {
        ...baseAskOrder,
        price: BigInt(9 * 10 ** 10),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(12_036_000_000),
          BigInt(1080 * 10 ** 8),
          BigInt(90_000_000_000),
          '01',
        )}"}`,
      }
      const askOrder_6_2 = {
        ...baseAskOrder,
        price: BigInt(95 * 10 ** 9),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(13_039_000_000),
          BigInt(1235 * 10 ** 8),
          BigInt(95_000_000_000),
          '01',
        )}"}`,
      }

      it('return correct capacity and sudt amount', () => {
        // @ts-ignore
        ordersService.startMatchAndReturnOutputs([bidOrder_6_1], [askOrder_6_1, askOrder_6_2])
        // @ts-ignore
        ordersService.pushDealerMakerCellAndData(biggestCell, dealMakerLock)
        // @ts-ignore
        rawTx = ordersService.generateRawTx()
        expect(BigInt(rawTx.outputs[0].capacity)).toEqual(BigInt(634973684))
        expect(BigInt(rawTx.outputs[1].capacity)).toEqual(BigInt(1080 * 10 ** 8))
        expect(BigInt(rawTx.outputs[2].capacity)).toEqual(BigInt(8367131573))
        expect(BigInt(rawTx.outputs[3].capacity)).toEqual(BigInt(103657894743))
        expect(BigInt('0x' + readBigUInt128LE(rawTx.outputsData[0].slice(2)))).toEqual(BigInt(65999999))
        expect(parseOrderData(rawTx.outputsData[1]).sudtAmount).toEqual(BigInt(633473685))
        expect(parseOrderData(rawTx.outputsData[1]).orderAmount).toEqual(BigInt(0))
        expect(parseOrderData(rawTx.outputsData[2]).sudtAmount).toEqual(BigInt(220 * 10 ** 8))
        expect(parseOrderData(rawTx.outputsData[2]).orderAmount).toEqual(BigInt(0))
        expect(parseOrderData(rawTx.outputsData[3]).sudtAmount).toEqual(BigInt(2375526316))
        expect(parseOrderData(rawTx.outputsData[3]).orderAmount).toEqual(BigInt(19842105257))
      })
    })
  })
})
