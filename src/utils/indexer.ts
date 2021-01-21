import { Indexer, CellCollector, TransactionCollector } from '@ckb-lumos/indexer'
import RPC from '@nervosnetwork/ckb-sdk-rpc'
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils'
import { Cell, Input, Script } from '@ckb-lumos/base'
import { logger } from './logger'
import { ORDER_SCRIPTS } from './conts'
import { isCellValid } from './validator'

const logTag = `\x1b[35m[Indexer]\x1b[0m`

export const startIndexer = async (url: string, dbPath: string) => {
  const indexer = new Indexer(url, dbPath)
  indexer.startForever()
  return indexer
}

// REFACTOR: return cells
export const scanOrderCells = async (indexer: Indexer, cellHandler: (cell: Cell[]) => Promise<void>) => {
  if (!indexer.running()) {
    indexer.startForever()
  }

  const cellCollector = new CellCollector(indexer, {
    lock: { script: ORDER_SCRIPTS.lock, argsLen: 'any' },
    type: { script: ORDER_SCRIPTS.type, argsLen: 'any' },
  })

  const cells: Cell[] = []
  for await (const cell of cellCollector.collect()) {
    if (isCellValid(cell)) {
      cells.push(cell)
    }
  }
  await cellHandler(cells)
  return cells.length
}

export const scanPlaceOrderLocks = async (
  indexer: Indexer,
  { fromBlock, toBlock, nodeUrl }: { fromBlock: string; toBlock: string; nodeUrl: string },
) => {
  if (!indexer.running()) {
    indexer.startForever()
  }

  const isOrderLock = (lock: Script) => {
    return lock && lock.code_hash === ORDER_SCRIPTS.lock.code_hash && lock.hash_type === ORDER_SCRIPTS.lock.hash_type
  }

  const isOrderType = (type: Script | undefined) => {
    return type && type.code_hash === ORDER_SCRIPTS.type.code_hash && type.hash_type === ORDER_SCRIPTS.type.hash_type
  }

  const txCollector = new TransactionCollector(
    indexer,
    {
      lock: { script: ORDER_SCRIPTS.lock, ioType: 'output', argsLen: 'any' },
      type: { script: ORDER_SCRIPTS.type, argsLen: 'any' },
      fromBlock,
      toBlock,
    },
    { includeStatus: false },
  )

  const inputList: Array<Input> = []
  for await (const tx of txCollector.collect()) {
    tx.outputs.forEach((output, i) => {
      if (isOrderLock(output.lock) && isOrderType(output.type)) {
        inputList.push(tx.inputs[i])
      }
    })
  }
  const rpc = new RPC(nodeUrl)
  const lockList: Map<string, CKBComponents.Script> = new Map()
  const batchParams: Array<['getTransaction', string]> = inputList.map(input => [
    'getTransaction',
    input.previous_output.tx_hash,
  ])
  if (!batchParams.length) {
    return lockList
  }
  const batchTxs = await rpc.createBatchRequest(batchParams).exec()
  inputList.forEach((input, i) => {
    try {
      const lock = batchTxs?.[i]?.transaction.outputs[+input.previous_output.index]?.lock
      if (lock) {
        const lockHash = scriptToHash(lock)
        if (!lockList.has(lockHash)) {
          lockList.set(lockHash, lock)
        }
      }
    } catch {
      // ignore
    }
  })
  return lockList
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
  /* istanbul ignore next */
  subscription.on('changed', () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      logger.info(`${logTag}: Transaction detected`)
      handler()
    }, 1000)
  })
}
