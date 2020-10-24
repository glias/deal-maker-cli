import Rpc from '@nervosnetwork/ckb-sdk-rpc'
import CKB from '@nervosnetwork/ckb-sdk-core'
import { DEFAULT_NODE_URL, ORDER_SCRIPTS } from '../utils'

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
) => {
  const ckb = new CKB(DEFAULT_NODE_URL)
  const keys = new Map()
  keys.set(ckb.utils.scriptToHash(lock), privateKey)
  const signedWitnesses = ckb.signWitnesses(keys)({
    transactionHash: ckb.utils.rawTransactionToHash(rawTransaction),
    witnesses: rawTransaction.witnesses,
    inputCells: rawTransaction.inputs.map((input, index) => {
      return {
        outPoint: input.previousOutput,
        lock:
          index === 0
            ? lock
            : {
                args: rawTransaction.outputs[1].lock.args,
                codeHash: ORDER_SCRIPTS.lock.code_hash,
                hashType: ORDER_SCRIPTS.lock.hash_type,
              },
      }
    }),
    skipMissingKeys: true,
  })
  const signedTx: any = { ...rawTransaction, witnesses: signedWitnesses }
  return await ckb.rpc.sendTransaction(signedTx)
}
