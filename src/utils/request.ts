import Rpc from '@nervosnetwork/ckb-sdk-rpc'

export const checkPendingDeals = async (url: string, txHashes: string[]) => {
  const rpc = new Rpc(url)
  const requests: Array<['getTransaction', string]> = txHashes.map(hash => ['getTransaction', hash])
  const batch = rpc.createBatchRequest(requests)
  return batch
    .exec()
    .then(resList => resList.map(res => res.txStatus === 'committed'))
    .catch(() => {
      return new Array(requests.length).fill(false)
    })
}
