import 'reflect-metadata'
import boostrap from './bootstrap'
import { container, modules } from './container'
import { logger } from './utils'
import ConfigService from './modules/config'
import { Config } from './modules/config/config.entity'
import TasksService from './modules/tasks'

const logTag = `\x1b[35m[Deal Maker]\x1b[0m`
export default class DealMaker {
  #ready = false
  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }

  private get configService() {
    return container.get<ConfigService>(modules[ConfigService.name])
  }

  private get tasksService() {
    return container.get<TasksService>(modules[TasksService.name])
  }

  #bootstrap = async () => {
    if (!this.#ready) {
      try {
        await boostrap()
        this.#ready = true
      } catch (err) {
        logger.error(err)
      }
    }
  }

  public run = async () => {
    // TODO: use decorator to handle bootstrap
    await this.#bootstrap()
    const config = await this.configService.getConfig()
    this.#log(`Start with config ${JSON.stringify(config)}`)
    this.tasksService.start()
  }

  public getConfig = async () => {
    await this.#bootstrap()
    return this.configService.getConfig()
  }

  public setConfig = async (key: Exclude<keyof Config, 'id' | 'remoteUrl'> | 'url', value: string) => {
    await this.#bootstrap()
    switch (key) {
      case 'url': {
        return this.configService.setRemoteUrl(value)
      }
      case 'feeRate': {
        return this.configService.setFeeRate(value)
      }
      case 'keyFile': {
        // TODO:
        return Promise.reject('key file setup not implemented')
      }
      case 'tokenPairs': {
        // TODO:
        return Promise.reject('token pairs setup not implemented')
      }
    }
    throw new Error(`${key} not found in config`)
  }
}
