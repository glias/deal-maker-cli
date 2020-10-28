import Rpc from '@nervosnetwork/ckb-sdk-rpc'

export const checkPendingDeals = async (rpcUrl: string, txHashes: string[]) => {
  const rpc = new Rpc(rpcUrl)
  const requests: Array<['getTransaction', string]> = txHashes.map(hash => ['getTransaction', hash])
  return rpc
    .createBatchRequest(requests)
    .exec()
    .then(resList => resList.map(res => res.txStatus.status === 'committed'))
    .catch(() => {
      return new Array<boolean>(requests.length).fill(false)
    })
}
