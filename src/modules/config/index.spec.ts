import { Connection, createConnection } from 'typeorm'
import ConfigService from '.'
import { Config } from './config.entity'

describe('Test config module', () => {
  let configService: ConfigService
  let connection: Connection

  beforeEach(async () => {
    connection = await createConnection('test')
    configService = new ConfigService()
  })

  afterEach(async () => {
    await connection.close()
  })

  it('should set app name', () => {
    expect(configService.appName).toBe('ckb_deal_maker')
  })

  it('should get config', async () => {
    const config = await configService.getConfig()
    expect(config).toEqual({
      id: 1,
      feeRate: '1000',
      keyFile: null,
      remoteUrl: 'http://localhost:8114',
      tokenPairs: '',
      tipBlockNumber: '0x0',
    })
  })

  it('should set remote url', async () => {
    const REMOTE_URL = 'http://localhost:8116'
    await configService.setRemoteUrl(REMOTE_URL)
    const config = await configService.getConfig()
    expect(config.remoteUrl).toBe(REMOTE_URL)
  })

  it('should set fee rate', async () => {
    const FEE_RATE = '5000'
    await configService.setFeeRate(FEE_RATE)
    const config = await configService.getConfig()
    expect(config.feeRate).toBe(FEE_RATE)
  })

  it('should set key file', async () => {
    const KEY_FILE_PATH = 'file://localhost/key/file/path'
    await configService.setKeyFile(KEY_FILE_PATH)
    const config = await configService.getConfig()
    expect(config.keyFile).toBe(KEY_FILE_PATH)
  })

  it('should set tip block number', async () => {
    const TIP_BLOCK_NUMBER = '1'
    await configService.setTipBlockNumber(TIP_BLOCK_NUMBER)
    const config = await configService.getConfig()
    expect(config.tipBlockNumber).toBe(TIP_BLOCK_NUMBER)
  })

  describe('update token pair', () => {
    const TOKEN_PAIRS = ['0xaaaa:0xbbbb', '0xbbbb:0xcccc']
    let config: Config
    describe('add token pair', () => {
      it('should add new token pair', async () => {
        config = await configService.getConfig()
        expect(config.tokenPairs).toBe('')

        await configService.addTokenPair(TOKEN_PAIRS[0])
        config = await configService.getConfig()
        expect(config.tokenPairs).toBe(TOKEN_PAIRS[0])

        await configService.addTokenPair(TOKEN_PAIRS[1])
        config = await configService.getConfig()
        expect(config.tokenPairs).toBe(TOKEN_PAIRS.join(','))
      })

      it('should change nothing when token pair exists', async () => {
        config = await configService.getConfig()
        expect(config.tokenPairs).toBe('')

        await configService.addTokenPair(TOKEN_PAIRS[0])
        config = await configService.getConfig()
        expect(config.tokenPairs).toBe(TOKEN_PAIRS[0])

        await configService.addTokenPair(TOKEN_PAIRS[0])
        config = await configService.getConfig()
        expect(config.tokenPairs).toBe(TOKEN_PAIRS[0])
      })

      it.skip('should throw error when token pair is invalid', () => {})
    })

    describe('remove token pair', () => {
      it('should remove token pair', async () => {
        for (const tokenPair of TOKEN_PAIRS) {
          await configService.addTokenPair(tokenPair)
        }
        config = await configService.getConfig()
        expect(config.tokenPairs).toBe(TOKEN_PAIRS.join(','))
        await configService.removeTokenPair(TOKEN_PAIRS[0])

        config = await configService.getConfig()
        expect(config.tokenPairs).toBe(TOKEN_PAIRS[1])
      })
    })
  })
})
