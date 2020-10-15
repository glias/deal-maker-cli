import DealMaker from '..'
import { logger } from '../utils'

const config = async () => {
  const dealMaker = new DealMaker()
  const config = await dealMaker.getConfig()
  logger.info(`\x1b[35mDeal Maker Configuration\x1b[0m:
\t\x1b[36mremote url\x1b[0m: ${config.remoteUrl}
\t\x1b[36mfee rate\x1b[0m: ${config.feeRate}
\t\x1b[36mkey file\x1b[0m: ${config.keyFile}
\t\x1b[36mtoken pairs\x1b[0m:
  \t${config.tokenPairs.replace(/,/, '\n\t')}
`)
}

export default {
  cmd: 'config',
  desc: 'view deal maker configuration',
  exec: config,
}
