import { injectable } from 'inversify'
import { logger } from '../../utils'

const logTag = `\x1b[35m[Orders Service]\x1b[0m`

@injectable()
class OrdersService {
  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }

  public match() {
    this.#log(`Match Orders`)
  }
}
export default OrdersService
