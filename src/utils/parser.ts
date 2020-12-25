import type { Cell } from '@ckb-lumos/base'
import BigNumber from 'bignumber.js'
import { OrderType } from '../modules/orders/order.entity'
import { PRICE_RATIO } from './conts'

/**
 * @param rawHexString hex string without 0x prefix
 */
export const readBigUInt128LE = (rawHexString: string) => {
  const buf = Buffer.from(rawHexString, 'hex')
  return buf.reverse().toString('hex')
}

const parsePrice = (price: string) => {
  let effect = BigInt(`0x${Buffer.from(price.substr(0, 16), 'hex').reverse().toString('hex')}`)
  const e = +`0x${price.slice(16)}`
  const view = new DataView(new ArrayBuffer(1))
  view.setUint8(0, e)
  let exponent = BigInt(view.getInt8(0))

  const MAX_EFFECT = BigInt('0xffffffffffffffff')
  while (effect * BigInt(10) < MAX_EFFECT) {
    effect = effect * BigInt(10)
    exponent -= BigInt(1)
  }
  return { effect, exponent }
}

const encodePrice = (price: Record<'effect' | 'exponent', bigint>) => {
  let { effect, exponent } = price
  const offset = `${effect}`.match(/0*$/)![0].length
  effect = effect / BigInt(10 ** offset)
  exponent += BigInt(offset)

  const view = new DataView(new ArrayBuffer(1))
  view.setInt8(0, Number(exponent))
  const e = +view.getUint8(0)
  return `${Buffer.from(effect.toString(16).padStart(16, '0'), 'hex').reverse().toString('hex')}${e
    .toString(16)
    .padStart(2, '0')}`
}

export const parseOrderData = (
  data: string,
): Record<'sudtAmount' | 'orderAmount', bigint> & {
  type: '00' | '01'
  version: '01'
  price: Record<'effect' | 'exponent', bigint>
} => {
  const sudtAmount = data.slice(2, 34)
  const version = data.slice(34, 36) as '01'
  const orderAmount = data.slice(36, 68)
  const price = data.slice(68, 86)
  const type = data.slice(86, 88) as '00' | '01'

  return {
    version,
    sudtAmount: BigInt('0x' + readBigUInt128LE(sudtAmount)),
    orderAmount: BigInt('0x' + readBigUInt128LE(orderAmount)),
    type,
    price: parsePrice(price),
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

export const encodeOrderData = (data: ReturnType<typeof parseOrderData>) => {
  return `0x${bigIntToUint128Le(data.sudtAmount)}${data.version}${bigIntToUint128Le(data.orderAmount)}${encodePrice(
    data.price,
  )}${data.type}`
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

const gcd = (a: bigint, b: bigint): bigint => {
  if (!b) {
    return a
  }

  return gcd(b, a % b)
}

const findBestDeal = (ckbAmount: bigint, price: bigint) => {
  const s = gcd(price, PRICE_RATIO)
  const p0 = price / s
  const n0 = PRICE_RATIO / s
  const sudt = n0 * (ckbAmount / p0)
  const ckb = (sudt * price) / PRICE_RATIO
  return { ckb, sudt }
}

type OrderInfo = Record<'capacity' | 'sudtAmount' | 'orderAmount', bigint> & {
  type: OrderType
  price: Record<'effect' | 'exponent', bigint>
}
export const formatDealInfo = (bidOrderInfo: OrderInfo, askOrderInfo: OrderInfo) => {
  const [bidPrice, askPrice] = [bidOrderInfo.price, askOrderInfo.price].map(price => {
    const exponent = Number(price.exponent)
    const p = price.effect * PRICE_RATIO
    return exponent >= 0 ? p * BigInt(10 ** exponent) : p / BigInt(10 ** (-1 * exponent))
  })
  const price = (bidPrice + askPrice) / BigInt(2)

  const { sudt: bidOrderAmount, ckb: bidCostAmount } = findBestDeal(
    (bidOrderInfo.orderAmount * price) / PRICE_RATIO,
    price,
  )

  const bidAmount = {
    costAmount: bidCostAmount, // cost capacity
    balance: bidOrderInfo.capacity, // balance in capacity
    orderAmount: bidOrderAmount, // order amount in sudt
    targetAmount: bidOrderInfo.sudtAmount + bidOrderAmount, // target amount in sudt
  }

  const { sudt: askCostAmount, ckb: askOrderAmount } = findBestDeal(askOrderInfo.orderAmount, price)

  const askAmount = {
    costAmount: askCostAmount, // cost sudt
    balance: askOrderInfo.sudtAmount, // balance in sudt
    orderAmount: askOrderAmount, // order amount in capacity
    targetAmount: askOrderInfo.capacity + askOrderAmount, // target capacity
  }

  if (
    askCostAmount &&
    ((askOrderAmount * PRICE_RATIO) / askCostAmount < askPrice ||
      (askOrderAmount * PRICE_RATIO) / askCostAmount > bidPrice)
  ) {
    askAmount.orderAmount = BigInt(0)
    askAmount.costAmount = BigInt(0)
  } else if (
    bidOrderAmount &&
    ((bidCostAmount * PRICE_RATIO) / bidOrderAmount > bidPrice ||
      (bidCostAmount * PRICE_RATIO) / bidOrderAmount < askPrice)
  ) {
    bidAmount.orderAmount = BigInt(0)
    bidAmount.costAmount = BigInt(0)
  }
  return {
    askAmount,
    bidAmount,
    price: new BigNumber(price.toString())
      .div(PRICE_RATIO.toString())
      .toFormat({ groupSeparator: '', decimalSeparator: '.' }),
  }
}

export const getPrice = (price: Record<'effect' | 'exponent', bigint>) => {
  const effect = new BigNumber(price.effect.toString())
  return effect.multipliedBy(new BigNumber(10).exponentiatedBy(Number(price.exponent)))
}
