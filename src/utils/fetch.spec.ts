jest.mock('node-fetch', () => require('fetch-mock').sandbox())
const fetchMock = require('node-fetch')

fetchMock.config.overwriteRoutes = false

import { fastSync, getTipBlockNumber } from './fetch'

describe('test fetch', () => {
  afterEach(() => {
    fetchMock.reset()
  })
  it('should return tip block number', async () => {
    const TIP_BLOCK_NUMBER = '0x1234'
    fetchMock.mock({ response: JSON.stringify({ result: TIP_BLOCK_NUMBER }) })
    const tipBlockNumber = await getTipBlockNumber('')
    expect(tipBlockNumber).toBe(TIP_BLOCK_NUMBER)
  })

  it('should return all cells', async () => {
    fetchMock.mock('*', JSON.stringify({ result: { objects: ['0x1', '0x2', '0x3'], last_cursor: '0x' } }))

    const save = jest.fn()
    await fastSync('', save)
    expect(save.mock.calls[0][0]).toEqual(['0x1', '0x2', '0x3'])
    // TODO: add mock
    // expect(save.mock.calls[1][0]).toEqual(['0x1', '0x2', '0x3'])
  })
})
