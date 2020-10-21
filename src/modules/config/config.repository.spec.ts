import { createConnection, getConnection } from 'typeorm'
import ConfigRepository from './config.repository'

describe('Test config repository', () => {
  let configRepository: ConfigRepository
  const CONNECTION_NAME = 'test'

  beforeAll(async () => {
    const connection = await createConnection(CONNECTION_NAME)
    configRepository = connection.getCustomRepository(ConfigRepository)
    await configRepository.init()
  })

  afterAll(async () => {
    await getConnection(CONNECTION_NAME).close()
  })

  it('should has default config', async () => {
    const config = await configRepository.getConfig()
    expect(config).toEqual({
      id: 1,
      remoteUrl: 'http://localhost:8114',
      tokenPairs: '',
      feeRate: '1000',
      keyFile: null,
      tipBlockNumber: '0x0',
    })
  })

  describe('Set remote url', () => {
    it('should set remote url when it is valid', async () => {
      const REMOTE_URL = 'http://localhost:8000'
      await configRepository.setRemoteUrl(REMOTE_URL)
      const config = await configRepository.getConfig()
      expect(config.remoteUrl).toBe(REMOTE_URL)
    })

    it('should throw an error when it is invalid', async () => {
      const REMOTE_URL = 'new remote url'
      try {
        await configRepository.setRemoteUrl(REMOTE_URL)
      } catch (err) {
        expect(err).toEqual(new Error('remote url must be an URL address'))
      }
    })
  })

  it('should set fee rate', async () => {
    const FEE_RATE = '5000'
    await configRepository.setFeeRate(FEE_RATE)
    const config = await configRepository.getConfig()
    expect(config.feeRate).toBe(FEE_RATE)
  })

  it('should set token pairs', async () => {
    const TOKEN_PAIRS = '0xeeeeeeeeeeee:0xffffffffffff'
    await configRepository.setTokenPairs(TOKEN_PAIRS)
    const config = await configRepository.getConfig()
    expect(config.tokenPairs).toBe(TOKEN_PAIRS)
  })

  it('should set key file', async () => {
    const KEY_FILE = 'file://localhost'
    await configRepository.setKeyFile(KEY_FILE)
    const config = await configRepository.getConfig()
    expect(config.keyFile).toBe(KEY_FILE)
  })

  it('should set tip block number', async () => {
    const TIP_BLOCK_NUMBER = '1'
    await configRepository.setTipBlockNumber(TIP_BLOCK_NUMBER)
    const config = await configRepository.getConfig()
    expect(config.tipBlockNumber).toBe(TIP_BLOCK_NUMBER)
  })
})
