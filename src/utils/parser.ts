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
  const sudtAmount = data.slice(2, 34)
  const orderAmount = data.slice(34, 66)
  const price = data.slice(66, 82)
  const type = data.slice(82, 84)
  return {
    sudtAmount: BigInt('0x' + readBigUInt128LE(sudtAmount)),
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
    output: {
      ...cell.cell_output,
      data: cell.data,
    },
  }
}
