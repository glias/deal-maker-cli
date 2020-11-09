import { injectable, inject, LazyServiceIdentifer } from 'inversify'
import { Indexer } from '@ckb-lumos/indexer'
import { CronJob } from 'cron'
import { modules } from '../../container'
import OrdersService from '../orders'
import ConfigService from '../config'
import {
  logger,
  startIndexer,
  scanOrderCells,
  subscribeOrderCell,
  checkPendingDeals,
  SUDT_TYPE_ARGS_LIST,
} from '../../utils'
import { DealStatus } from '../orders/deal.entity'

const logTag = `\x1b[35m[Tasks Service]\x1b[0m`

@injectable()
class TasksService {
  readonly #ordersService: OrdersService
  readonly #configService: ConfigService
  #indexer!: Indexer
  readonly #schedule = {
    match: '*/5 * * * * *',
    checkPending: '*/10 * * * * *',
  }
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
    // REFACTOR: should start a single cron job
    SUDT_TYPE_ARGS_LIST.forEach((args: string) => {
      // istanbul ignore next
      new CronJob(this.#schedule.match, () => this.#ordersService.prepareMatch(this.#indexer, args), null, true)
    })
    new CronJob(this.#schedule.checkPending, this.checkPendingDeals, null, true)
  }

  readonly startIndexer = async () => {
    const nodeUrl = await this.#configService.getConfig().then(config => config.remoteUrl)
    const indexerDbPath = this.#configService.getDbPath().indexer
    this.#indexer = await startIndexer(nodeUrl, indexerDbPath)
  }

  readonly scanOrderCells = async () => {
    return scanOrderCells(this.#indexer, this.#ordersService.flushOrders)
  }

  readonly subscribeOrderCell = async () => {
    this.#log(`Subscribe to order cell`)
    return subscribeOrderCell(this.#indexer, this.scanOrderCells)
  }

  readonly checkPendingDeals = async () => {
    const pendingDeals = await this.#ordersService.getPendingDeals()
    if (!pendingDeals.length) return

    const nodeUrl = await this.#configService.getConfig().then(config => config.remoteUrl)
    const checkResults = await checkPendingDeals(
      nodeUrl,
      pendingDeals.map(d => d.txHash),
    )

    const now = Date.now()
    const TIMEOUT = 60 * 10 * 1000 // 10 minutes

    for (let i = 0; i < pendingDeals.length; i++) {
      const deal = pendingDeals[i]
      if (checkResults[i]) {
        await this.#ordersService.updateDealStatus(deal.txHash, DealStatus.Done)
      } else if (now - deal.createdAt.getTime() >= TIMEOUT) {
        await this.#ordersService.updateDealStatus(deal.txHash, DealStatus.TIMEOUT)
      }
    }
  }

  readonly getSyncState = async () => {
    const tip = await this.#indexer.tip().then(tip => +tip.block_number)
    return { tip }
  }
}

export default TasksService
