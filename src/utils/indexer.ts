import { Indexer, CellCollector } from '@ckb-lumos/indexer'
import { INDEXER_DB, ORDER_SCRIPTS } from './conts'

export const startIndexer = async (url: string) => {
  const indexer = new Indexer(url, INDEXER_DB)
  indexer.startForever()
  return indexer
}

export const scanOrderCells = async (indexer: Indexer, cellHandler: any) => {
  indexer.startForever()
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
