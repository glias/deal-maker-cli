import Rpc from '@nervosnetwork/ckb-sdk-rpc'
import CKB from '@nervosnetwork/ckb-sdk-core'
import { DEFAULT_NODE_URL } from '../utils'

export const checkPendingDeals = async (rpcUrl: string, txHashes: string[]) => {
  const rpc = new Rpc(rpcUrl)
  const requests: Array<['getTransaction', string]> = txHashes.map(hash => ['getTransaction', hash])
  return rpc
    .createBatchRequest(requests)
    .exec()
    .then(resList => resList.map(res => res?.txStatus?.status === 'committed'))
    .catch(() => {
      return new Array<boolean>(requests.length).fill(false)
    })
}

export const signAndSendTransaction = async (
  rawTransaction: CKBComponents.RawTransactionToSign,
  privateKey: string,
) => {
  const ckb = new CKB(DEFAULT_NODE_URL)
  const signedWitness = ckb.signWitnesses(privateKey)({
    transactionHash: ckb.utils.rawTransactionToHash(rawTransaction),
    witnesses: [{ lock: '', inputType: '', outputType: '' }],
  })[0]
  const signedTx: any = { ...rawTransaction, witnesses: [signedWitness, ...rawTransaction.witnesses.slice(1)] }
  return await ckb.rpc.sendTransaction(signedTx)
}
