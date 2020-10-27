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

  describe('Test Order Match Method', () => {
    const minerFee = BigInt(1_0000)
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
    describe('Full match order', () => {
      const baseFullyMatchBidOrder: OrderDto = {
        id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
        tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
        type: OrderType.Bid,
        price: BigInt(100_000_000_000),
        blockNumber: 55,
        output: `{"capacity":"0x175a588b00","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(0),
          BigInt(10_000_000_000),
          BigInt(100_000_000_000),
          '00',
        )}"}`,
      }
      const baseFullyMatchAskOrder: OrderDto = {
        id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
        tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
        type: OrderType.Bid,
        price: BigInt(90_000_000_000),
        blockNumber: 55,
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(10_030_000_000),
          BigInt(90_000_000_000),
          BigInt(90_000_000_000),
          '00',
        )}"}`,
      }
      describe('same block number', () => {
        it.only('return correct outputs', () => {
          // @ts-ignore
          ordersService.startMatchAndReturnOutputs([baseFullyMatchAskOrder], [baseFullyMatchBidOrder])
          // @ts-ignore
          ordersService.pushDealerMakerCellAndData(biggestCell, dealMakerLock)
          // @ts-ignore
          rawTx = ordersService.generateRawTx(dealMakerLock)
          expect(BigInt(rawTx.outputs[0].capacity)).toEqual((BigInt(95000000000) * BigInt(3)) / BigInt(1000) - minerFee)
          expect(BigInt(rawTx.outputs[1].capacity)).toEqual(BigInt(5015000000))
          expect(BigInt(rawTx.outputs[2].capacity)).toEqual(BigInt(90000000000))
          expect(BigInt('0x' + readBigUInt128LE(rawTx.outputsData[0].slice(2)))).toEqual(
            (BigInt(90000000000) * shannonsRatio * BigInt(3)) / BigInt(950000000) / BigInt(1000),
          )
          expect(parseOrderData(rawTx.outputsData[1]).sudtAmount).toEqual(BigInt(10_000_000_000))
          expect(parseOrderData(rawTx.outputsData[2]).sudtAmount).toEqual(BigInt(527_894_738))
        })
      })

      describe('different block number', () => {
        const askOrder2 = { ...baseFullyMatchAskOrder, blockNumber: 50 }

        it('returns correct capacity and sudt amount', () => {
          // @ts-ignore
          ordersService.startMatchAndReturnOutputs([askOrder2], [baseFullyMatchBidOrder])
          // @ts-ignore
          ordersService.pushDealerMakerCellAndData(biggestCell, dealMakerLock)
          // @ts-ignore
          rawTx = ordersService.generateRawTx(dealMakerLock)
          expect(BigInt(rawTx.outputs[0].capacity)).toEqual((BigInt(90000000000) * BigInt(3)) / BigInt(1000) - minerFee)
          expect(BigInt(rawTx.outputs[1].capacity)).toEqual(BigInt(10030000000))
          expect(BigInt(rawTx.outputs[2].capacity)).toEqual(BigInt(90000000000))
          expect(BigInt('0x' + readBigUInt128LE(rawTx.outputsData[0].slice(2)))).toEqual(
            (BigInt(90000000000) * shannonsRatio * BigInt(3)) / BigInt(900000000) / BigInt(1000),
          )
          expect(parseOrderData(rawTx.outputsData[1]).sudtAmount).toEqual(BigInt(10_000_000_000))
          expect(parseOrderData(rawTx.outputsData[2]).sudtAmount).toEqual(BigInt(0))
        })
      })
    })
  })
})
