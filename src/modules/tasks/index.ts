import { injectable, inject, LazyServiceIdentifer } from 'inversify'
import { modules } from '../../container'
import { logger } from '../../utils'
import PoolService from '../pool'
import OrdersService from '../orders'

const logTag = `\x1b[35m[Tasks Service]\x1b[0m`

@injectable()
class TasksService {
  readonly #poolService: PoolService
  readonly #ordersService: OrdersService
  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }

  constructor(
    @inject(new LazyServiceIdentifer(() => modules[PoolService.name])) poolService: PoolService,
    @inject(new LazyServiceIdentifer(() => modules[OrdersService.name])) ordersService: OrdersService,
  ) {
    this.#poolService = poolService
    this.#ordersService = ordersService
  }

  start = () => {
    this.work()
    this.#log('Tasks start')
  }

  work = () => {
    setInterval(() => {
      this.#log('New Round')
      this.#ordersService.match()
      this.#poolService.match()
    }, 1000)
    return 'wrok'
  }
}

export default TasksService
