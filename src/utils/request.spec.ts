const mockExec = jest.fn()
jest.mock('@nervosnetwork/ckb-sdk-rpc', () => {
  return class MockRpc {
    createBatchRequest() {
      return {
        exec: mockExec,
      }
    }
  }
})

import { checkPendingDeals } from './request'

describe('Test request', () => {
  describe('Test checkPendingOrders', () => {
    const MOCK_URL = 'mock_url'
    const MOCK_TX_HASHES = ['0x0', '0x1', '0x2']

    describe('when request is resolved', () => {
      beforeAll(() => {
        mockExec.mockResolvedValue([
          { txStatus: { status: 'committed' } },
          { txStatus: { status: 'pending' } },
          { txStatus: { status: 'committed' } },
        ])
      })
      it('should return check results', async () => {
        const res = await checkPendingDeals(MOCK_URL, MOCK_TX_HASHES)
        expect(res).toEqual([true, false, true])
      })
    })

    describe('when request is rejected', () => {
      beforeAll(() => {
        mockExec.mockRejectedValue(null)
      })

      it('should return all false', async () => {
        const res = await checkPendingDeals(MOCK_URL, MOCK_TX_HASHES)
        expect(res).toEqual([false, false, false])
      })
    })
  })
})
