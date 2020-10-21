import type { Cell } from '@ckb-lumos/base'

const readBigUInt64LE = (rawHexString: string) => {
  return Buffer.from(rawHexString, 'hex').readBigUInt64LE().toString(16)
}

/**
 *
 * @param rawHexString hex string without 0x prefix
 */
const readBigUInt128LE = (rawHexString: string) => {
  const buf = Buffer.from(rawHexString, 'hex')
  return buf.reverse().toString('hex')
}

export const parseOrderData = (data: string) => {
  '0x00f2052a01000000000000000000000000f2052a01000000000000000000000000d6117e030000000000000000000000005847f80d00000000'
  const sudtAmount = data.slice(2, 34)
  const tradeAmount = data.slice(34, 66)
  const orderAmount = data.slice(66, 98)
  const price = data.slice(98, 114)
  const type = data.slice(114, 116)
  return {
    sudtAmount: BigInt('0x' + readBigUInt128LE(sudtAmount)),
    tradeAmount: BigInt('0x' + readBigUInt128LE(tradeAmount)),
    orderAmount: BigInt('0x' + readBigUInt128LE(orderAmount)),
    price: BigInt('0x' + readBigUInt64LE(price)),
    type,
  }
}

export const parseOrderCell = (cell: Cell) => {
  const id = `${cell.out_point!.tx_hash}-${cell.out_point!.index}`
  const tokenId = cell.cell_output.type?.args || 'ckb'
  const orderData = parseOrderData(cell.data)
  const blockNumber = +cell.block_number!
  const { type, price } = orderData

  return {
    id,
    tokenId,
    blockNumber,
    type,
    price,
    output: cell.cell_output,
  }
}
