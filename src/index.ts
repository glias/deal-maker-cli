import 'reflect-metadata'
import fs from 'fs'
import { CronJob } from 'cron'
import boostrap from './bootstrap'
import { container, modules } from './container'
import { logger, parseOrderData, UI_SUDT_TYPE_ARGS, WEB_UI_PORT } from './utils'
import ConfigService from './modules/config'
import TasksService from './modules/tasks'
import OrdersService from './modules/orders'
import bootstrapWebUi from './webui'
import { OrderDto } from './modules/orders/order.dto'
import { Deal, DealStatus } from './modules/orders/deal.entity'

const logTag = `\x1b[35m[Deal Maker]\x1b[0m`
export default class DealMaker {
  #ready = false
  #webUi: ReturnType<typeof bootstrapWebUi> | undefined
  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }

  private get configService() {
    return container.get<ConfigService>(modules[ConfigService.name])
  }

  private get tasksService() {
    return container.get<TasksService>(modules[TasksService.name])
  }

  private get orderService() {
    return container.get<OrdersService>(modules[OrdersService.name])
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
    // start web ui
    if (WEB_UI_PORT) {
      this.#webUi = bootstrapWebUi(+WEB_UI_PORT, {
        onConnect: () => this.syncWebUi(UI_SUDT_TYPE_ARGS),
        onSetConfig: (...args: Parameters<DealMaker['setConfig']>) => {
          this.setConfig(...args)
            .then(() => this.syncWebUi(UI_SUDT_TYPE_ARGS))
            .then(() => process.exit(0))
        },
      })
    }
    new CronJob('*/3 * * * * *', () => this.syncWebUi(UI_SUDT_TYPE_ARGS), null, true)
  }

  public getConfig = async () => {
    await this.#bootstrap()
    return this.configService.getConfig()
  }

  public setConfig = async (key: 'url' | 'feeRate' | 'keyFile' | 'addTokenPair' | 'removeTokenPair', value: string) => {
    await this.#bootstrap()
    switch (key) {
      case 'url': {
        return this.configService.setRemoteUrl(value)
      }
      case 'feeRate': {
        return this.configService.setFeeRate(value)
      }
      case 'keyFile': {
        return this.configService.setKeyFile(value)
      }
      case 'addTokenPair': {
        return this.configService.addTokenPair(value)
      }
      case 'removeTokenPair': {
        return this.configService.removeTokenPair(value)
      }
      default: {
        throw new Error(`${key} not found in config`)
      }
    }
  }

  public getOrders = async (sudtTypeArgs: string) => {
    await this.#bootstrap()
    const [asks, bids] = await Promise.all([
      this.orderService.getAskOrders(sudtTypeArgs),
      this.orderService.getBidOrders(sudtTypeArgs),
    ])
    return {
      asks,
      bids,
    }
  }
  public reset = async () => {
    await this.#bootstrap()
    await this.orderService.clearOrders()
    this.#log(`Orders cleared`)
    try {
      const indexerDbPath = this.configService.getDbPath().indexer
      fs.unlinkSync(indexerDbPath)
      this.#log(`Indexer data cleared`)
    } catch (err) {
      logger.warn(err.message)
    }
  }

  public syncWebUi = async (sudtTypeArgs: string) => {
    if (!this.#webUi) return

    const orderParser = (order: OrderDto) => {
      try {
        const output = JSON.parse(order.output)
        const { sudtAmount, orderAmount } = parseOrderData(output.data)
        return {
          price: order.price.toString(),
          sudtAmount: sudtAmount.toString(),
          orderAmount: orderAmount.toString(),
          outPoint: order.id,
          capacity: output.capacity,
          type: process.env.WEB_UI_USER || 'user',
        }
      } catch (err) {
        return {
          price: '',
          sudtAmount: '',
          orderAmount: '',
          outPoint: '',
          capacity: '',
        }
      }
    }
    const dealParser = (deal: Deal) => {
      return {
        txHash: deal.txHash,
        fee: deal.fee,
        ckbProfit: deal.ckbProfit,
        sudtProfit: deal.sudtProfit,
        status: DealStatus[deal.status],
        createdAt: deal.createdAt.toISOString(),
      }
    }
    const [askOrders, bidOrders, deals, config, syncState] = await Promise.all([
      this.orderService.getAskOrders(sudtTypeArgs).then(orders => orders.map(orderParser)),
      this.orderService.getBidOrders(sudtTypeArgs).then(orders => orders.map(orderParser)),
      this.orderService.getDeals(0, sudtTypeArgs).then(deals => deals.map(dealParser)),
      this.configService.getConfig(),
      this.tasksService.getSyncState(),
    ])

    const type = process.env.WEB_UI_USER || 'user'
    if (type !== 'admin') {
      config.keyFile = null
    }

    this.#webUi.stat({ askOrders, bidOrders, config, deals, syncState, type })
  }
}
