import Rpc from '@nervosnetwork/ckb-sdk-rpc'
import CKB from '@nervosnetwork/ckb-sdk-core'
import fs from 'fs'
import { Indexer, CellCollector } from '@ckb-lumos/indexer'
import { startIndexer, PRIVATE_KEY_PATH, DEFAULT_NODE_URL } from '../utils'
import ConfigService from '../modules/config'

export const checkPendingDeals = async (rpcUrl: string, txHashes: string[]) => {
  const rpc = new Rpc(rpcUrl)
  const requests: Array<['getTransaction', string]> = txHashes.map(hash => ['getTransaction', hash])
  return rpc
    .createBatchRequest(requests)
    .exec()
    .then(resList => resList.map(res => res.txStatus === 'committed'))
    .catch(() => {
      return new Array<boolean>(requests.length).fill(false)
    })
}

export const signAndSendTransaction = async (
  rawTransaction: CKBComponents.RawTransactionToSign,
  privateKey: string,
  lock: CKBComponents.Script,
  indexer: Indexer | undefined,
) => {
  const ckb = new CKB(DEFAULT_NODE_URL)
  const cells = await ckb.loadCells({ indexer, CellCollector, lock })

  const signedTx = ckb.signTransaction(privateKey)(rawTransaction, cells)
  return await ckb.rpc.sendTransaction(signedTx)
}
