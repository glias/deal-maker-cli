const mockLogger = { info: jest.fn() }
const mockStartIndexer = jest.fn()
const mockScanOrderCells = jest.fn()
const mockSubscribeOrderCell = jest.fn()
const mockCheckPendingDeals = jest.fn()
const mockGetPendingDeals = jest.fn()
const mockUpdateDealStatus = jest.fn()
const mockCronConstructor = jest.fn()

jest.setMock('cron', {
  CronJob: mockCronConstructor,
})

jest.setMock('../../utils/', {
  logger: mockLogger,
  startIndexer: mockStartIndexer,
  scanOrderCells: mockScanOrderCells,
  subscribeOrderCell: mockSubscribeOrderCell,
  checkPendingDeals: mockCheckPendingDeals,
})

import 'reflect-metadata'
import { injectable } from 'inversify'
import TasksService from '.'
import ConfigService from '../config'
import OrdersService from '../orders'
import { container, modules } from '../../container'
import { DealStatus } from '../orders/deal.entity'
import { pendingDeal } from '../../mock'

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
}

describe('Test tasks module', () => {
  let tasksService: TasksService
  let mockConfigService: MockConfigService
  let mockOrdersService: MockOrdersService
  let scanOrderCells
  let startIndexer
  let subscribeOrderCell

  beforeAll(async () => {
    modules[ConfigService.name] = Symbol(ConfigService.name)
    modules[OrdersService.name] = Symbol(OrdersService.name)
    modules[TasksService.name] = Symbol(TasksService.name)
    container.bind(modules[ConfigService.name]).to(MockConfigService)
    container.bind(modules[OrdersService.name]).to(MockOrdersService)
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
      expect(mockOrdersService.match).toBeCalledTimes(1)
    })

    it('should start a cron job', () => {
      expect(mockCronConstructor).toBeCalledTimes(1)
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
})
