import { Repository, EntityRepository } from 'typeorm'
import { isURL } from 'class-validator'
import { Config } from './config.entity'

@EntityRepository(Config)
class ConfigRepository extends Repository<Config> {
  #id = 1
  #defaultConfig = {
    id: this.#id,
    remoteUrl: 'http://localhost:8114',
    feeRate: '1000',
    tokenPairs: '',
  }

  public init = async (): Promise<void> => {
    const config = await this.findOne(this.#id)
    if (!config) {
      await this.save(this.#defaultConfig)
    }
  }

  public getConfig = async (): Promise<Config> => {
    const config = await this.findOne(this.#id)
    if (!config) await this.init()
    return this.findOne(this.#id) as any
  }

  public setRemoteUrl = async (url: string): Promise<boolean> => {
    if (!isURL(url, { require_tld: false, require_protocol: true, require_host: true })) {
      throw new Error('remote url must be an URL address')
    }
    const config = await this.getConfig()
    config.remoteUrl = url
    await this.save(config)
    return true
  }

  public setFeeRate = async (feeRate: string): Promise<boolean> => {
    const config = await this.getConfig()
    config.feeRate = feeRate
    await this.save(config)
    return true
  }

  public setTokenPairs = async (tokenPairs: string): Promise<boolean> => {
    const config = await this.getConfig()
    config.tokenPairs = tokenPairs
    await this.save(config)
    return true
  }

  public setKeyFile = async (keyFile: string): Promise<boolean> => {
    const config = await this.getConfig()
    config.keyFile = keyFile
    await this.save(config)
    return true
  }

  public setTipBlockNumber = async (tipBlockNumber: string): Promise<boolean> => {
    const config = await this.getConfig()
    config.tipBlockNumber = tipBlockNumber
    await this.save(config)
    return true
  }
}

export default ConfigRepository
