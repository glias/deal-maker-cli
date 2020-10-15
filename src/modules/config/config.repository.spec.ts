import { createConnection } from 'typeorm'
import ConfigRepository from './config.repository'

describe('Test config repository', () => {
  let configRepository: ConfigRepository

  beforeAll(async () => {
    const connection = await createConnection('test')
    configRepository = connection.getCustomRepository(ConfigRepository)
  })

  beforeEach(async () => {
    await configRepository.init()
  })

  it('should has default config', async () => {
    const config = await configRepository.getConfig()
    expect(config).toEqual({
      id: 1,
      remoteUrl: 'http://localhost:8114',
      tokenPairs: '',
      feeRate: '1000',
      keyFile: null,
    })
  })

  it('should set remote url', async () => {
    const REMOTE_URL = 'new remote url'
    await configRepository.setRemoteUrl(REMOTE_URL)
    const config = await configRepository.getConfig()
    expect(config.remoteUrl).toBe(REMOTE_URL)
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
})
