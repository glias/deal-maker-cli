import { injectable, inject, LazyServiceIdentifer } from 'inversify'
// import { CronJob } from 'cron'
import { modules } from '../../container'
import { logger, getTipBlockNumber } from '../../utils'
import OrdersService from '../orders'
import ConfigService from '../config'

const logTag = `\x1b[35m[Tasks Service]\x1b[0m`

@injectable()
class TasksService {
  readonly #ordersService: OrdersService
  readonly #configService: ConfigService
  // readonly #schedule = {
  //   match: '*/5 * * * * *',
  //   sync: '*/10 * * * * *',
  // }
  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }

  constructor(
    @inject(new LazyServiceIdentifer(() => modules[OrdersService.name])) ordersService: OrdersService,
    @inject(new LazyServiceIdentifer(() => modules[ConfigService.name])) configService: ConfigService,
  ) {
    this.#ordersService = ordersService
    this.#configService = configService
  }

  start = async () => {
    this.#log('Tasks start')
    const remoteUrl = await this.#configService.getConfig().then(config => config.remoteUrl)
    await this.fastSync(remoteUrl)
    this.#ordersService.match()
    // new CronJob(this.#schedule.match, this.#match, null, true)
    // new CronJob(this.#schedule.sync, this.#sync, null, true)
  }

  // #sync = () => {
  //   this.#fetchBlock()
  // }

  // #fetchBlock = async () => {
  //   const config = await this.#configService.getConfig()
  //   if (!config.remoteUrl) {
  //     return
  //   }
  //   const apiUrl = `${config.remoteUrl}`

  //   return apiUrl
  // }

  fastSync = async (remoteUrl: string) => {
    const tipBlockNumber = await getTipBlockNumber(`${remoteUrl}/rpc`)
    this.#configService.setTipBlockNumber(tipBlockNumber)
    //   await fastSync(`${url}/indexer`, console.log)
  }
}

export default TasksService
