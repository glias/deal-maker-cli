jest.mock('@nervosnetwork/ckb-sdk-rpc', () => {
  return class MockRpc {
    createBatchRequest() {
      return {
        exec: jest
          .fn()
          .mockResolvedValue([{ txStatus: 'committed' }, { txStatus: 'pending' }, { txStatus: 'committed' }]),
      }
    }
  }
})

import { checkPendingDeals } from './request'

describe('Test request', () => {
  describe('Test checkPendingOrders', () => {
    const MOCK_URL = 'mock_url'
    const MOCK_TX_HASHES = ['0x0', '0x1', '0x2']
    it('should return check results', async () => {
      const res = await checkPendingDeals(MOCK_URL, MOCK_TX_HASHES)
      expect(res).toEqual([true, false, true])
    })
  })
})
