import { Repository, EntityRepository } from 'typeorm'
import { Config } from './config.entity'

@EntityRepository(Config)
class ConfigRepository extends Repository<Config> {
  public init = async (): Promise<boolean> => {
    const count = await this.count()
    if (!count) {
      const config = this.create()
      await this.save(config)
      return true
    }
    return false
  }

  public getConfig = async (): Promise<Config> => {
    const config = await this.findOne()
    if (!config) await this.init()
    return this.findOne() as any
  }

  public setRemoteUrl = async (url: string): Promise<boolean> => {
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
}

export default ConfigRepository
