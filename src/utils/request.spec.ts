const mockExec = jest.fn()
const mockSendTransactionRpc = jest.fn()
jest.mock('@nervosnetwork/ckb-sdk-rpc', () => {
  return class MockRpc {
    createBatchRequest() {
      return {
        exec: mockExec,
      }
    }
    sendTransaction = mockSendTransactionRpc
  }
})

import { checkPendingDeals, signAndSendTransaction } from './request'

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

  describe('Test sign and send transaction', () => {
    it('should send signed transaction', async () => {
      const TX: CKBComponents.RawTransactionToSign = {
        cellDeps: [],
        headerDeps: [],
        inputs: [
          {
            since: '0x0',
            previousOutput: {
              txHash: '0x001748c1b5749af9636b940ae7d8d56d12a3de83f9020e765a5e108ca87873fa',
              index: '0x0',
            },
          },
          {
            since: '0x0',
            previousOutput: {
              txHash: '0x00317da41f64a75f7cb0bd0238857e1dc75d50fae3f8bbab1e20e18840df024c',
              index: '0x0',
            },
          },
        ],
        outputs: [
          {
            capacity: '0x189640200',
            lock: {
              args: '0x3cb5366451256c3c9f8d4e2fc2e2aa8fa5774756',
              codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
              hashType: 'type',
            },
          },
          {
            capacity: '0x31eb37587',
            lock: {
              args: '0xc11d75be4531c9c0cca7531bab077f9a1710c87c',
              codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
              hashType: 'type',
            },
          },
        ],
        outputsData: ['0x', '0x'],
        version: '0x0',
        witnesses: [
          {
            lock: '',
            inputType: '',
            outputType: '',
          },
          '0x',
        ],
      }

      const PRIV_KEY = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      await signAndSendTransaction(TX, PRIV_KEY)
      expect(mockSendTransactionRpc).toBeCalledWith({
        cellDeps: [],
        headerDeps: [],
        inputs: [
          {
            previousOutput: {
              index: '0x0',
              txHash: '0x001748c1b5749af9636b940ae7d8d56d12a3de83f9020e765a5e108ca87873fa',
            },
            since: '0x0',
          },
          {
            previousOutput: {
              index: '0x0',
              txHash: '0x00317da41f64a75f7cb0bd0238857e1dc75d50fae3f8bbab1e20e18840df024c',
            },
            since: '0x0',
          },
        ],
        outputs: [
          {
            capacity: '0x189640200',
            lock: {
              args: '0x3cb5366451256c3c9f8d4e2fc2e2aa8fa5774756',
              codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
              hashType: 'type',
            },
          },
          {
            capacity: '0x31eb37587',
            lock: {
              args: '0xc11d75be4531c9c0cca7531bab077f9a1710c87c',
              codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
              hashType: 'type',
            },
          },
        ],
        outputsData: ['0x', '0x'],
        version: '0x0',
        witnesses: [
          '0x5500000010000000550000005500000041000000b112acb3f3730e490122e5cb6175edea3049cc87789666aefa2f84f47b64e78021921509e2b4244e3a1f8f1e898a9b95b2ea514f880ef8b4587fcb4066bef5f100',
          '0x',
        ],
      })
    })
  })
})
