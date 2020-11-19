import type { Cell } from '@ckb-lumos/base'
import { toUint64Le } from '@nervosnetwork/ckb-sdk-utils/lib/convertors'

const readBigUInt64LE = (rawHexString: string) => {
  return Buffer.from(rawHexString, 'hex').readBigUInt64LE().toString(16)
}

/**
 *
 * @param rawHexString hex string without 0x prefix
 */
export const readBigUInt128LE = (rawHexString: string) => {
  const buf = Buffer.from(rawHexString, 'hex')
  return buf.reverse().toString('hex')
}

export const parseOrderData = (
  data: string,
): Record<'sudtAmount' | 'orderAmount' | 'price', bigint> & { type: '00' | '01' } => {
  const sudtAmount = data.slice(2, 34)
  const orderAmount = data.slice(34, 66)
  const price = data.slice(66, 82)
  const type = data.slice(82, 84) as '00' | '01'
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
  const { type, price, orderAmount, sudtAmount } = orderData

  return {
    id,
    tokenId,
    blockNumber,
    type,
    price,
    orderAmount,
    sudtAmount,
    output: {
      ...cell.cell_output,
      data: cell.data,
    },
  }
}

export const bigIntToUint128Le = (u128: bigint) => {
  const buf = Buffer.alloc(16)
  buf.writeBigUInt64LE(u128 & BigInt('0xFFFFFFFFFFFFFFFF'), 0)
  buf.writeBigUInt64LE(u128 >> BigInt(64), 8)
  return `${buf.toString('hex')}`
}

export const formatOrderData = (currentSudtAmount: bigint, orderAmount: bigint, price: bigint, type: '00' | '01') => {
  return `0x${bigIntToUint128Le(currentSudtAmount)}${bigIntToUint128Le(orderAmount)}${toUint64Le(price).slice(
    2,
  )}${type}`
}

type Order = ReturnType<typeof parseOrderData> & { capacity: bigint }

interface Orders {
  miner: { capacity: bigint; sudtAmount: bigint }
  orders: Array<Order>
}
export const parsePlaceOrderTx = (inputs: Orders, outputs: Orders) => {
  const bidOrders = {
    inputs: inputs.orders.filter(o => o.type === '00'),
    outputs: outputs.orders.filter(o => o.type === '00'),
  }
  const askOrders = {
    inputs: inputs.orders.filter(o => o.type === '01'),
    outputs: outputs.orders.filter(o => o.type === '01'),
  }

  const formatLog = (input: Order, output: Order) => ({
    'capacity:before': input.capacity,
    'capacity:after': output.capacity,
    'capacity:delta': output.capacity - input.capacity,
    'sudt:before': input.sudtAmount,
    'sudt:after': output.sudtAmount,
    'sudt:delta': output.sudtAmount - input.sudtAmount,
  })

  const bidLogs = bidOrders.inputs.map((input, idx) => {
    const output = bidOrders.outputs[idx]
    return { name: `bid ${idx}`, ...formatLog(input, output) }
  })
  const askLogs = askOrders.inputs.map((input, idx) => {
    const output = askOrders.outputs[idx]
    return { name: `ask ${idx}`, ...formatLog(input, output) }
  })

  const minerLog = {
    'name': 'miner',
    'capacity:before': inputs.miner.capacity,
    'capacity:after': outputs.miner.capacity,
    'capacity:delta': outputs.miner.capacity - inputs.miner.capacity,
    'sudt:before': inputs.miner.sudtAmount,
    'sudt:after': outputs.miner.sudtAmount,
    'sudt:delta': outputs.miner.sudtAmount - inputs.miner.sudtAmount,
  }

  const delta = {
    capacity:
      bidLogs.reduce((sum, b) => sum + b['capacity:delta'], BigInt(0)) +
      askLogs.reduce((sum, a) => sum + a['capacity:delta'], BigInt(0)) +
      minerLog['capacity:delta'],
    sudt:
      bidLogs.reduce((sum, b) => sum + b['sudt:delta'], BigInt(0)) +
      askLogs.reduce((sum, a) => sum + a['sudt:delta'], BigInt(0)) +
      minerLog['sudt:delta'],
  }
  return {
    bidLogs,
    askLogs,
    minerLog,
    delta,
  }
}
