import { injectable, inject, LazyServiceIdentifer } from 'inversify'
import { Indexer } from '@ckb-lumos/indexer'
// import { CronJob } from 'cron'
import { modules } from '../../container'
import OrdersService from '../orders'
import ConfigService from '../config'
import { logger, startIndexer, scanOrderCells, subscribeOrderCell } from '../../utils'

const logTag = `\x1b[35m[Tasks Service]\x1b[0m`

@injectable()
class TasksService {
  readonly #ordersService: OrdersService
  readonly #configService: ConfigService
  #indexer!: Indexer
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
    await this.startIndexer()
    await this.scanOrderCells()
    this.subscribeOrderCell()
    this.#ordersService.match()
    // new CronJob(this.#schedule.match, this.#match, null, true)
    // new CronJob(this.#schedule.sync, this.#sync, null, true)
  }

  startIndexer = async () => {
    const remoteUrl = await this.#configService.getConfig().then(config => config.remoteUrl)
    const indexerDbPath = this.#configService.getDbPath().indexer
    this.#indexer = await startIndexer(remoteUrl, indexerDbPath)
  }

  scanOrderCells = async () => {
    await this.#ordersService.clearOrders()
    return scanOrderCells(this.#indexer, this.#ordersService.saveOrder)
  }

  subscribeOrderCell = async () => {
    this.#log(`Subscribe to order cell`)
    return subscribeOrderCell(this.#indexer, this.scanOrderCells)
  }
}

export default TasksService
