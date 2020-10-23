import 'reflect-metadata'
import fs from 'fs'
import { CronJob } from 'cron'
import boostrap from './bootstrap'
import { container, modules } from './container'
import { logger, parseOrderData } from './utils'
import ConfigService from './modules/config'
import TasksService from './modules/tasks'
import OrdersService from './modules/orders'
import bootstrapWebUi from './webui'
import { OrderDto } from './modules/orders/order.dto'

const logTag = `\x1b[35m[Deal Maker]\x1b[0m`
export default class DealMaker {
  #ready = false
  #webUi: ReturnType<typeof bootstrapWebUi>
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

  constructor() {
    this.#webUi = bootstrapWebUi(this.syncWebUi)
  }

  #bootstrap = async () => {
    if (!this.#ready) {
      try {
        await boostrap()
        new CronJob('*/10 * * * * *', this.syncWebUi, null, true)
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

  public getOrders = async () => {
    await this.#bootstrap()
    const [asks, bids] = await Promise.all([this.orderService.getAskOrders(), this.orderService.getBidOrders()])
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

  public syncWebUi = async () => {
    const orderParser = (order: OrderDto) => {
      try {
        const output = JSON.parse(order.output)
        const { sudtAmount, orderAmount } = parseOrderData(output.data)
        return {
          price: order.price.toString(),
          blockNumber: order.blockNumber.toString(),
          sudtAmount: sudtAmount.toString(),
          orderAmount: orderAmount.toString(),
          outPoint: order.id,
          capacity: output.capacity,
        }
      } catch (err) {
        return {
          price: '',
          blockNumber: '',
          sudtAmount: '',
          orderAmount: '',
          outPoint: '',
          capacity: '',
        }
      }
    }
    const [askOrders, bidOrders, config] = await Promise.all([
      this.orderService.getAskOrders().then(orders => orders.map(orderParser)),
      this.orderService.getBidOrders().then(orders => orders.map(orderParser)),
      this.configService.getConfig(),
    ])
    this.#webUi.stat({ askOrders, bidOrders, config })
  }
}
