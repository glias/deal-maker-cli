import { injectable } from 'inversify'
import { getConnection } from 'typeorm'
import ConfigRepository from './config.repository'
import { Config } from './config.entity'

@injectable()
class ConfigService {
  #appName = 'ckb_deal_maker'
  get appName() {
    return this.#appName
  }
  #configRepository = getConnection(process.env.NODE_ENV).getCustomRepository(ConfigRepository)

  public getConfig = (): Promise<Config> => {
    return this.#configRepository.getConfig()
  }

  public setRemoteUrl = (url: string): Promise<boolean> => {
    return this.#configRepository.setRemoteUrl(url)
  }

  public setFeeRate = (feeRate: string): Promise<boolean> => {
    return this.#configRepository.setFeeRate(feeRate)
  }

  public addTokenPair = async (tokenPair: string): Promise<boolean> => {
    const config = await this.getConfig()
    const tokenPairs = new Set(config.tokenPairs.split(',').filter(p => p))
    tokenPairs.add(tokenPair)
    return this.#configRepository.setTokenPairs([...tokenPairs].join(','))
  }
  public removeTokenPair = async (tokenPair: string): Promise<boolean> => {
    const config = await this.getConfig()
    const tokenPairs = new Set(config.tokenPairs.split(','))
    tokenPairs.delete(tokenPair)
    return this.#configRepository.setTokenPairs([...tokenPairs].join(','))
  }
}

export default ConfigService
