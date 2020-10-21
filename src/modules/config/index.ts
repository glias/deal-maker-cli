import os from 'os'
import path from 'path'
import { injectable } from 'inversify'
import { getConnection } from 'typeorm'
import ConfigRepository from './config.repository'
import { Config } from './config.entity'
import { INDEXER_DB } from '../../utils'

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

  public setTipBlockNumber = async (tipBlockNumber: string): Promise<boolean> => {
    return this.#configRepository.setTipBlockNumber(tipBlockNumber)
  }

  public setKeyFile = async (keyFilePath: string): Promise<boolean> => {
    return this.#configRepository.setKeyFile(keyFilePath)
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

  public getDbPath = () => {
    const sqlite = getConnection(process.env.NODE_ENV).options.database

    const indexer =
      typeof sqlite === 'string' ? path.join(sqlite, '..', INDEXER_DB) : path.join(os.tmpdir(), INDEXER_DB)

    return { sqlite, indexer }
  }
}

export default ConfigService
