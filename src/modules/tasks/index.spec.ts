const mockLogger = { info: jest.fn(), warn: jest.fn() }
const mockGetPrivateKey = jest.fn()
const mockSignAndSendTransaction = jest.fn()
const mockStartIndexer = jest.fn().mockReturnValue({ tip: () => Promise.resolve({ block_number: '0x0101' }) })
const mockScanOrderCells = jest.fn()
const mockSubscribeOrderCell = jest.fn()
const mockCheckPendingDeals = jest.fn()
const mockTokenIdList = ['0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902']

const mockScanPlaceOrderLocks = jest.fn().mockResolvedValue([])

const mockGetBidOrders = jest.fn().mockResolvedValue([])
const mockGetAskOrders = jest.fn().mockResolvedValue([])
const mockGetPendingDeals = jest.fn().mockResolvedValue([])
const mockSaveDeal = jest.fn()

const mockLoadCells = jest.fn()

const mockMatch = jest.fn()
const mockMatcherConstructor = jest.fn()
let stubRawTx: any = null

const mockUpdateDealStatus = jest.fn()
const mockCronConstructor = jest.fn()

jest.setMock('cron', {
  CronJob: mockCronConstructor,
})
jest.doMock('@nervosnetwork/ckb-sdk-core/lib/loadCellsFromIndexer', () => mockLoadCells)

jest.doMock(
  './matcher',
  () =>
    class {
      dealMakerCell
      constructor(bidOrderList, askOrderList, dealMakerCell) {
        mockMatcherConstructor(bidOrderList, askOrderList, dealMakerCell)
        this.dealMakerCell = dealMakerCell
      }
      match = mockMatch
      get rawTx() {
        return stubRawTx
      }
    },
)

jest.setMock('../../utils/', {
  ...jest.requireActual('../../utils'),
  logger: mockLogger,
  getPrivateKey: mockGetPrivateKey,
  signAndSendTransaction: mockSignAndSendTransaction,
  startIndexer: mockStartIndexer,
  scanOrderCells: mockScanOrderCells,
  subscribeOrderCell: mockSubscribeOrderCell,
  checkPendingDeals: mockCheckPendingDeals,
  scanPlaceOrderLocks: mockScanPlaceOrderLocks,
  SUDT_TYPE_ARGS_LIST: mockTokenIdList,
})

import 'reflect-metadata'
import { injectable } from 'inversify'
import TasksService from '.'
import ConfigService from '../config'
import OrdersService from '../orders'
import LocksService from '../locks'
import { container, modules } from '../../container'
import { DealStatus } from '../orders/deal.entity'
import { pendingDeal } from '../../mock'
import { MATCH_ORDERS_CELL_DEPS } from '../../utils'
import { OutPoint } from '@ckb-lumos/base/lib/core'

const MOCK_REMOTE_URL = 'mock_remote_url'
const MOCK_INDEXER_PATH = 'mock_indexer_path'

@injectable()
class MockConfigService {
  getConfig = jest.fn().mockResolvedValue({ remoteUrl: MOCK_REMOTE_URL })
  getDbPath = jest.fn().mockReturnValue({ indexer: MOCK_INDEXER_PATH })
}

@injectable()
class MockOrdersService {
  match = jest.fn()
  getPendingDeals = mockGetPendingDeals
  updateDealStatus = mockUpdateDealStatus
  getBidOrders = mockGetBidOrders
  getAskOrders = mockGetAskOrders
  saveDeal = mockSaveDeal
}

@injectable()
class MockLocksService {
  getBlockNumber = jest.fn().mockReturnValue('0')
  setBlockNumber = jest.fn().mockResolvedValue(undefined)
  addLockList = jest.fn().mockResolvedValue(undefined)
  findByLockHashList = jest.fn().mockResolvedValue([])
}

describe('Test tasks module', () => {
  let tasksService: TasksService
  let mockConfigService: MockConfigService
  let mockOrdersService: MockOrdersService
  let mockLocksService: MockLocksService
  let scanOrderCells
  let startIndexer
  let subscribeOrderCell

  beforeAll(async () => {
    modules[ConfigService.name] = Symbol(ConfigService.name)
    modules[OrdersService.name] = Symbol(OrdersService.name)
    modules[LocksService.name] = Symbol(LocksService.name)
    modules[TasksService.name] = Symbol(TasksService.name)
    container.bind(modules[ConfigService.name]).to(MockConfigService)
    container.bind(modules[OrdersService.name]).to(MockOrdersService)
    container.bind(modules[LocksService.name]).to(MockLocksService)
    container.bind(modules[TasksService.name]).to(TasksService)

    tasksService = container.get(modules[TasksService.name])
    mockConfigService = container.get(modules[ConfigService.name])
    mockOrdersService = container.get(modules[OrdersService.name])
    scanOrderCells = jest.spyOn(tasksService, 'scanOrderCells')
    startIndexer = jest.spyOn(tasksService, 'startIndexer')
    subscribeOrderCell = jest.spyOn(tasksService, 'subscribeOrderCell')
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Test tasksService#start', () => {
    beforeEach(async () => {
      await tasksService.start()
    })
    it('should call tasksService#{startIndexer, scanOrderCells, subscribeOrderCell}', () => {
      expect(startIndexer).toBeCalledTimes(1)
      expect(scanOrderCells).toBeCalledTimes(1)
      expect(subscribeOrderCell).toBeCalledTimes(1)
    })

    it('should start 3 cron jobs', () => {
      expect(mockCronConstructor).toBeCalledTimes(3)
    })
  })

  describe('Test tasksService#startIndexer', () => {
    beforeEach(async () => {
      await tasksService.startIndexer()
    })

    it('should call configService#{getConfig, getDbPath} and startIndexer', () => {
      expect(mockConfigService.getConfig).toBeCalledTimes(1)
      expect(mockConfigService.getDbPath).toBeCalledTimes(1)
      expect(startIndexer).toBeCalledTimes(1)
    })
  })

  describe('Test tasksService#scanOrderCells', () => {
    beforeEach(async () => {
      await tasksService.scanOrderCells()
    })

    it('should call scanOrderCells', () => {
      expect(mockScanOrderCells).toBeCalledTimes(1)
    })
  })

  describe('Test tasksService#scanPlaceOrderLocks', () => {
    beforeEach(async () => {
      await tasksService.scanPlaceOrderLocks()
    })

    it('should call scanPlaceOrderLocks', () => {
      expect(mockScanPlaceOrderLocks).toBeCalledTimes(1)
    })

    describe.skip('tasksService#isScanningPlaceOrder is true', () => {
      it('should skip this task', () => {})
    })
  })

  describe('Test tasksService#subscribeOrderCell', () => {
    beforeEach(async () => {
      await tasksService.subscribeOrderCell()
    })
    it('should call tasksService#log and subscribeOrderCell', () => {
      expect(mockLogger.info).toBeCalledWith('\x1b[35m[Tasks Service]\x1b[0m: Subscribe to order cell')
      expect(mockSubscribeOrderCell).toBeCalledTimes(1)
    })
  })

  describe('Test tasksService#checkPendingDeals', () => {
    beforeEach(async () => {
      await tasksService.checkPendingDeals()
    })
    afterAll(() => {
      mockGetPendingDeals.mockReset()
      mockCheckPendingDeals.mockReset()
    })

    describe('done', () => {
      beforeAll(() => {
        mockGetPendingDeals.mockResolvedValueOnce([{ ...pendingDeal, createdAt: new Date() }])
        mockCheckPendingDeals.mockResolvedValueOnce([true])
      })

      it('should set status to done', () => {
        expect(mockUpdateDealStatus).toBeCalledTimes(1)
        expect(mockUpdateDealStatus).toBeCalledWith(pendingDeal.txHash, DealStatus.Done)
      })
    })

    describe('timeout', () => {
      beforeAll(() => {
        mockGetPendingDeals.mockResolvedValueOnce([{ ...pendingDeal, createdAt: new Date(0) }])
        mockCheckPendingDeals.mockResolvedValueOnce([false])
      })

      it('should set status to timeout', async () => {
        expect(mockUpdateDealStatus).toBeCalledTimes(1)
        expect(mockUpdateDealStatus).toBeCalledWith(pendingDeal.txHash, DealStatus.TIMEOUT)
      })
    })

    describe('pending', () => {
      beforeAll(() => {
        mockGetPendingDeals.mockResolvedValueOnce([{ ...pendingDeal, createdAt: new Date() }])
        mockCheckPendingDeals.mockResolvedValueOnce([false])
      })

      it('should do nothing', async () => {
        expect(mockUpdateDealStatus).not.toBeCalled()
      })
    })

    describe('no pending deals', () => {
      beforeAll(() => {
        mockGetPendingDeals.mockResolvedValueOnce([])
        mockCheckPendingDeals.mockResolvedValueOnce([])
      })

      it('should do nothing', async () => {
        expect(mockUpdateDealStatus).not.toBeCalled()
      })
    })
  })

  describe('Test tasksService#getSyncState', () => {
    it('should return state including tip', async () => {
      const state = await tasksService.getSyncState()
      expect(state).toEqual({ tip: 257 })
    })
  })

  describe('Test tasksService#matchOrders', () => {
    const dealMakerCell = {
      data: '',
      lock: {
        codeHash: '',
        hashType: 'type',
        args: '0x',
      },
      capacity: '0x0',
      outPoint: { txHash: '0x0', index: '0x0' },
    }
    it('should return false when private key is not found', async () => {
      mockGetPrivateKey.mockReturnValue(null)
      const res = await tasksService.matchOrders()
      expect(res).toBe(false)
      expect(mockLogger.warn).toBeCalledWith('\x1b[35m[Tasks Service]\x1b[0m: No private key found')
    })

    it('return skip matching when order list is empty', async () => {
      mockGetPrivateKey.mockReturnValue('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
      const res = await tasksService.matchOrders()
      expect(res).toEqual(mockTokenIdList.map(() => false))
      expect(mockLoadCells).toBeCalledTimes(0)
    })

    describe('when available deal maker cells are not found', () => {
      beforeEach(() => {
        mockGetPrivateKey.mockReturnValue('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
        mockOrdersService.getBidOrders.mockResolvedValue([1, 2, 3])
        mockOrdersService.getAskOrders.mockResolvedValue([1, 2, 3])
        mockOrdersService.getPendingDeals.mockResolvedValue([])
        mockLoadCells.mockResolvedValue([
          {
            ...dealMakerCell,
            type: {
              codeHash: '0x0',
              hashType: 'type',
              args: '0x0',
            },
          },
        ])
      })

      it('should log and skip matching ', async () => {
        const res = await tasksService.matchOrders()
        expect(mockLogger.info).toBeCalledWith(
          `\x1b[35m[Tasks Service]\x1b[0m: No normal cells or ${mockTokenIdList[0]} live cells`,
        )
        expect(res).toEqual(mockTokenIdList.map(() => false))
      })
    })

    describe('when available deal maker cells are pending', () => {
      beforeEach(() => {
        mockGetPrivateKey.mockReturnValue('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
        mockOrdersService.getBidOrders.mockResolvedValue([1, 2, 3])
        mockOrdersService.getAskOrders.mockResolvedValue([1, 2, 3])
        mockOrdersService.getPendingDeals.mockResolvedValue([{ dealMakerCell: 'mock_tx_hash:mock_index' }])
        mockLoadCells.mockResolvedValue([
          {
            ...dealMakerCell,
            outPoint: {
              txHash: 'mock_tx_hash',
              index: 'mock_index',
            },
          },
        ])
      })

      it('should log and skip matching ', async () => {
        const res = await tasksService.matchOrders()
        expect(mockLogger.info).toBeCalledWith(
          `\x1b[35m[Tasks Service]\x1b[0m: No normal cells or ${mockTokenIdList[0]} live cells`,
        )
        expect(res).toEqual(mockTokenIdList.map(() => false))
      })
    })

    describe('Match Orders', () => {
      const BID_ORDERS = ['mock_bid_order_0', 'mock_bid_order_1']
      const ASK_ORDERS = ['mock_ask_order_0']
      const PRIVATE_KEY = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      beforeEach(() => {
        mockGetPrivateKey.mockReturnValue(PRIVATE_KEY)
        mockOrdersService.getBidOrders.mockResolvedValue(BID_ORDERS)
        mockOrdersService.getAskOrders.mockResolvedValue(ASK_ORDERS)
        mockOrdersService.getPendingDeals.mockResolvedValue([])
        mockLoadCells.mockResolvedValue([dealMakerCell, { ...dealMakerCell, capacity: '0x0' }])
      })

      it('should match', async () => {
        await tasksService.matchOrders()
        expect(mockMatcherConstructor).toBeCalledWith(BID_ORDERS, ASK_ORDERS, dealMakerCell)
      })

      describe('when matcher.rawTx is null', () => {
        beforeEach(() => {
          mockMatch.mockReturnValue(null)
        })

        it('should skip sending transaction', async () => {
          const res = await tasksService.matchOrders()
          expect(res).toEqual(mockTokenIdList.map(() => false))
        })
      })

      describe('when matcher.rawTx is a non-null', () => {
        beforeEach(() => {
          stubRawTx = {
            version: '0x0',
            headerDeps: [],
            cellDeps: MATCH_ORDERS_CELL_DEPS,
            inputs: [
              { previousOutput: { txHash: '0x0', index: '0x0' }, since: '0x0' },
              {
                previousOutput: {
                  txHash: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee',
                  index: '0x0',
                },
                since: '0x0',
              },
              {
                previousOutput: {
                  txHash: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee',
                  index: '0x2',
                },
                since: '0x0',
              },
            ],
            witnesses: [{ lock: '', inputType: '', outputType: '' }, '0x', '0x'],
            outputs: [
              {
                capacity: '0x5e85440',
                lock: { codeHash: '0x', hashType: 'data', args: '0x' },
                type: { codeHash: '0x', hashType: 'data', args: '0x' },
              },
              {
                capacity: '0x0',
                lock: {
                  codeHash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
                  hashType: 'data',
                  args: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                },
                type: {
                  codeHash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
                  hashType: 'type',
                  args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
                },
              },
              {
                capacity: '0x14f46b0400',
                lock: {
                  codeHash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
                  hashType: 'data',
                  args: '0xffffffffffffffffffffffffffffffffffffffff',
                },
                type: {
                  codeHash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
                  hashType: 'type',
                  args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
                },
              },
            ],
            outputsData: [
              '0x00000000000000000000000000000000',
              '0x00e40b540200000000000000000000000000000000000000000000000000000000046bf41400000000',
              '0x000000000000000000000000000000000000000000000000000000000000000000046bf41400000001',
            ],
          }
        })
        it('should call signAndSendTransaction ', async () => {
          await tasksService.matchOrders()
          expect(mockSignAndSendTransaction).toBeCalledWith(stubRawTx, PRIVATE_KEY)
        })
        describe('when signAndSendTransaction return tx hash', () => {
          const TX_HASH = 'mock_tx_hash'
          it('should save record with pending status', async () => {
            mockSignAndSendTransaction.mockResolvedValue(TX_HASH)
            await tasksService.matchOrders()
            expect(mockSaveDeal).toBeCalledWith(
              expect.objectContaining({
                txHash: TX_HASH,
                status: DealStatus.Pending,
              }),
            )
          })
        })

        describe('when signAndSendTransaction throw error', () => {
          it('should save record with failed status and log', async () => {
            const MESSAGE = 'mock_error_message'
            mockSignAndSendTransaction.mockRejectedValue(MESSAGE)
            await tasksService.matchOrders()
            expect(mockLogger.warn).toBeCalledWith(`\x1b[35m[Tasks Service]\x1b[0m: ${MESSAGE}`)
            expect(mockSaveDeal).toBeCalledWith(
              expect.objectContaining({
                status: DealStatus.Failed,
              }),
            )
          })
        })
      })
    })
  })
})
