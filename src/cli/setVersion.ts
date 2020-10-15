import fs from 'fs'
import type { Command } from 'commander'
import { logger } from '../utils'
import path from 'path'

const setVersion = (program: InstanceType<typeof Command>) => {
  try {
    /* append version */
    const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'))
    if (packageInfo.version) {
      program.version(packageInfo.version)
    }
  } catch (err) {
    logger.error('Fail to load package version')
  }
}
export default setVersion
