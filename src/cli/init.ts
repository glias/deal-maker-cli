import { exec } from 'child_process'
import { logger } from '../utils'

const init = () => {
  exec('npm run db:init', err => {
    if (err) {
      logger.error(err)
      return
    }
    logger.info('deal maker is initialized')
  })
}

export default {
  cmd: 'init',
  desc: 'init deal maker',
  exec: init,
}
