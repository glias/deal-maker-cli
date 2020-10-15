import { injectable } from 'inversify'
import { logger } from '../../utils'

const logTag = `\x1b[35m[Pool Service]\x1b[0m`

@injectable()
class PoolService {
  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }

  public match() {
    this.#log(`match cells`)
  }
}

export default PoolService
