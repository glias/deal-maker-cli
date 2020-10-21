import DealMaker from '..'
import { logger } from '../utils'

type SetConfigParams = Partial<Record<'url' | 'feeRate' | 'keyFile' | 'addTokenPair' | 'removeTokenPair', string>>

const setConfig = async (config: SetConfigParams) => {
  const dealMaker = new DealMaker()
  await dealMaker.getConfig()
  Object.entries(config).forEach(([k, v]: any) => {
    if (v !== undefined) {
      dealMaker
        .setConfig(k, v)
        .then(() => {
          logger.info(`${k} is updated with "${v}"`)
        })
        .catch(logger.error)
    }
  })
}

const printConfig = async () => {
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

const options: Record<string, Record<'option' | 'desc', string>> = {
  url: {
    option: '--url <url>',
    desc: 'rich node url',
  },
  feeRate: {
    option: '--fee-rate <fee rate>',
    desc: 'fee rate',
  },
  keyFile: {
    option: '--key-file <key file>',
    desc: 'key file path',
  },
  addTokenPair: {
    option: '--add-token-pair <token pair>',
    desc: 'add token pair',
  },
  removeTokenPair: {
    option: '--remove-token-pair <token pair>',
    desc: 'remove token pair',
  },
}

export default {
  cmd: 'config',
  desc: 'view or set deal maker configuration',
  options,
  exec: (cmdObj: any) => {
    const { url, feeRate, keyFile, addTokenPair, removeTokenPair } = cmdObj
    if (url || feeRate || keyFile || addTokenPair || removeTokenPair) {
      setConfig({ url, feeRate, keyFile, addTokenPair, removeTokenPair })
    } else {
      printConfig()
    }
  },
}
