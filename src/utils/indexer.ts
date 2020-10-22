import { Indexer, CellCollector } from '@ckb-lumos/indexer'
import { Cell } from '@ckb-lumos/base'
import { logger } from './logger'
import { ORDER_SCRIPTS } from './conts'

const logTag = `\x1b[35m[Indexer]\x1b[0m`

export const startIndexer = async (url: string, dbPath: string) => {
  const indexer = new Indexer(url, dbPath)
  indexer.startForever()
  return indexer
}

export const scanOrderCells = async (indexer: Indexer, cellHandler: (cell: Cell) => void) => {
  if (!indexer.running()) {
    indexer.startForever()
  }

  const cellCollector = new CellCollector(indexer, {
    lock: { script: ORDER_SCRIPTS.lock, argsLen: 'any' },
    type: { script: ORDER_SCRIPTS.type, argsLen: 'any' },
  })

  let total = 0
  for await (const cell of cellCollector.collect()) {
    cellHandler(cell)
    total += 1
  }
  return total
}

export const subscribeOrderCell = async (indexer: Indexer, handler: Function) => {
  if (!indexer.running()) {
    indexer.startForever()
  }
  const subscription = indexer.subscribe({
    lock: { code_hash: ORDER_SCRIPTS.lock.code_hash, hash_type: ORDER_SCRIPTS.lock.hash_type, args: '0x' },
    argsLen: 0,
  })

  let timer: NodeJS.Timeout
  subscription.on('changed', () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      logger.info(`${logTag}: Transaction detected`)
      handler()
    }, 3000)
  })
}
