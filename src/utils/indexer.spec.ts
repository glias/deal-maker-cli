const mockStartForever = jest.fn()
const mockRunning = jest.fn()
const mockIndexerConstructor = jest.fn()
const mockCellCollectorConstructor = jest.fn()
const mockIndexerSubscribe = jest.fn()

const mockCell = {
  cell_output: {
    capacity: '0x1b618f4914',
    lock: {
      code_hash: '0xc8f9ffa3de3171006d5c499b77624f815072f21a047ebaf38dfeeee980dde500',
      hash_type: 'type',
      args: '0xcd4259b4a39812deed351f9f647972cb064a3473aa1681c0ee8899bccd46e89f',
    },
    type: {
      code_hash: '0xe1e354d6d643ad42724d40967e334984534e0367405c5ae42a9d7d63d77df419',
      hash_type: 'data',
      args: '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947',
    },
  },
  out_point: {
    tx_hash: '0xbdde18cdb8e879fabbd06c717c219f9bc95d5089cd4bd4393f3ba472d3412a6c',
    index: '0x0',
  },
  block_hash: '0xb3de6ac4a59c4bd20d4812d87b6c249d9f884491275c73d86ef788f38226977e',
  block_number: '0x7542f',
}

class MockCellCollector {
  left: number = 1
  constructor(...args) {
    mockCellCollectorConstructor(...args)
  }
  async *collect() {
    yield {
      ...mockCell,
      data: '0xa150f1050000000000000000000000000000000000000000000000000000000000ac23fc0600000000',
    }
    yield {
      ...mockCell,
      data: '0x',
    }
    yield {
      ...mockCell,
      data: '0xa150f1050000000000000000000000000000000000000000000000000000000000ac23fc0611111101',
    }
    return
  }
}
class MockIndexer {
  uri = 'mock_url'
  constructor(...args) {
    mockIndexerConstructor(...args)
  }
  startForever = mockStartForever
  running = mockRunning
  tip = jest.fn()
  start = jest.fn()
  stop = jest.fn()
  subscribe = mockIndexerSubscribe
  collect = jest.fn()
  collector = new MockCellCollector()
}

jest.doMock('@ckb-lumos/indexer', () => ({
  Indexer: MockIndexer,
  CellCollector: MockCellCollector,
}))

import { ORDER_SCRIPTS } from './conts'
import { startIndexer, scanOrderCells, subscribeOrderCell } from './indexer'

describe('Test Indexer Utils', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })
  describe('Test start indexer', () => {
    const fixture = {
      uri: 'mock_uri',
      dbPath: 'mock_db_path',
    }

    it(`should start indexer with url: ${fixture.uri} and dbPath: ${fixture.dbPath}`, async () => {
      const indexer = await startIndexer(fixture.uri, fixture.dbPath)
      expect(indexer).toBeInstanceOf(MockIndexer)
      expect(mockIndexerConstructor).toBeCalledWith(fixture.uri, fixture.dbPath)
      expect(mockStartForever).toBeCalledTimes(1)
    })
  })

  describe('Test scan order cells', () => {
    const indexer: any = new MockIndexer('mock_uri', 'mock_db_path')
    const mockCellHandler = jest.fn().mockImplementation(a => console.info(a))

    it('should start indexer if indexer#running is falsy', async () => {
      mockRunning.mockReturnValue(false)
      await scanOrderCells(indexer, mockCellHandler)
      expect(indexer.startForever).toBeCalledTimes(1)
    })

    it('should instantiate CellCollector with correct query option', async () => {
      const QUERY_OPTION = {
        lock: { script: ORDER_SCRIPTS.lock, argsLen: 'any' },
        type: { script: ORDER_SCRIPTS.type, argsLen: 'any' },
      }
      await scanOrderCells(indexer, mockCellHandler)
      expect(mockCellCollectorConstructor).toBeCalledWith(indexer, QUERY_OPTION)
    })

    it('should handle 2 mock cell and skip invalid cell', async () => {
      const res = await scanOrderCells(indexer, mockCellHandler)
      expect(mockCellHandler).toBeCalledWith([
        { ...mockCell, data: '0xa150f1050000000000000000000000000000000000000000000000000000000000ac23fc0600000000' },
        { ...mockCell, data: '0xa150f1050000000000000000000000000000000000000000000000000000000000ac23fc0611111101' },
      ])
      expect(res).toBe(2)
    })
  })

  describe('Test subscribe order cell', () => {
    const indexer: any = new MockIndexer('mock_uri', 'mock_db_path')
    const mockCellHandler = jest.fn().mockImplementation(a => console.info(a))
    const mockListener = jest.fn()
    beforeEach(() => {
      mockIndexerSubscribe.mockReturnValue({ on: mockListener })
    })

    it('should start indexer if indexer#running is falsy', async () => {
      mockRunning.mockReturnValue(false)
      await subscribeOrderCell(indexer, mockCellHandler)
      expect(indexer.startForever).toBeCalledTimes(1)
    })

    it('should subscribe with correct query option', async () => {
      const QUERY_OPTION = {
        lock: { code_hash: ORDER_SCRIPTS.lock.code_hash, hash_type: ORDER_SCRIPTS.lock.hash_type, args: '0x' },
        argsLen: 0,
      }
      await subscribeOrderCell(indexer, mockCellHandler)
      expect(mockIndexerSubscribe).toBeCalledWith(QUERY_OPTION)
    })

    it('should subscribe changed event', async () => {
      await subscribeOrderCell(indexer, mockCellHandler)
      expect(mockListener).toBeCalledWith('changed', expect.anything())
    })
  })
})
