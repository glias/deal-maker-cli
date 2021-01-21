import { getTransactionSize } from '@nervosnetwork/ckb-sdk-utils'
import BigNumber from 'bignumber.js'
import { OrderDto } from '../orders/order.dto'
import { OrderType } from '../orders/order.entity'
import {
  parseOrderData,
  formatDealInfo,
  encodeOrderData,
  readBigUInt128LE,
  getPrice,
  findBestDeal,
  FEE,
  FEE_RATIO,
  MATCH_ORDERS_CELL_DEPS,
  bigIntToUint128Le,
  ORDER_CELL_SIZE,
  SHANNONS_RATIO,
  SUDT_CELL_SIZE,
  PRICE_RATIO,
} from '../../utils'
import { Lock } from '../locks/lock.entity'

type Price = Record<'effect' | 'exponent', bigint>
type OrderInfo = Record<'capacity' | 'sudtAmount' | 'orderAmount', bigint> & { type: OrderType; price: Price }
type Scripts = Record<'lock' | 'type', CKBComponents.Script>

interface MatchedOrder {
  id: string
  scripts: Scripts
  info: OrderInfo
  ownerLock: Lock | null
}

interface Order extends MatchedOrder {
  price: Price
  part?: boolean
}

const ORDER_CELL_MIN_CAPACITY = BigInt(ORDER_CELL_SIZE) * BigInt(SHANNONS_RATIO)

export default class {
  matchedOrderList: Array<MatchedOrder> = []
  bidOrderList: Order[]
  askOrderList: Order[]
  dealMakerCapacityAmount: bigint = BigInt(0)
  dealMakerSudtAmount: bigint = BigInt(0)
  dealMakerCell: RawTransactionParams.Cell
  minerFee = BigInt(0)
  get rawTx(): CKBComponents.RawTransactionToSign | null {
    if (!this.matchedOrderList.length) {
      return null
    }

    const inputs: CKBComponents.CellInput[] = []
    const outputs: CKBComponents.CellOutput[] = []
    const outputsData: string[] = []
    this.matchedOrderList.forEach(o => {
      if (this.#isOrderClaimable(o.info)) {
        const { lockHash: _, ...lock } = o.ownerLock!
        const type = o.info.type === OrderType.Bid || o.info.sudtAmount ? o.scripts.type : null
        const data =
          o.info.type === OrderType.Bid || o.info.sudtAmount ? `0x${bigIntToUint128Le(o.info.sudtAmount)}` : '0x'

        outputs.push({ capacity: `0x${o.info.capacity.toString(16)}`, type, lock })
        outputsData.push(data)
      } else {
        outputs.push({ capacity: `0x${o.info.capacity.toString(16)}`, ...o.scripts })
        outputsData.push(
          encodeOrderData({
            sudtAmount: o.info.sudtAmount,
            orderAmount: o.info.orderAmount,
            price: o.info.price,
            type: o.info.type === OrderType.Bid ? '00' : '01',
            version: '01',
          }),
        )
      }
      const [txHash, index] = o.id.split('-')
      if (!inputs.find(i => i.previousOutput?.txHash === txHash && i.previousOutput.index === index)) {
        inputs.push({ previousOutput: { txHash, index }, since: '0x0' })
      }
    })
    const dealMaker = {
      capacity: BigInt(this.dealMakerCell.capacity) + this.dealMakerCapacityAmount,
      sudt:
        this.dealMakerSudtAmount +
        (this.dealMakerCell.data !== '0x'
          ? BigInt('0x' + readBigUInt128LE(this.dealMakerCell.data.slice(2)))
          : BigInt(0)),
    }
    const dealMakerCell = {
      input: { previousOutput: this.dealMakerCell.outPoint, since: '0x0' },
      witness: { lock: '', inputType: '', outputType: '' },
      output: {
        capacity: `0x${dealMaker.capacity.toString(16)}`,
        lock: this.dealMakerCell.lock,
        type: this.dealMakerCell.type,
      },
      data: `0x${bigIntToUint128Le(dealMaker.sudt)}`,
    }
    const rawTx = {
      version: '0x0',
      headerDeps: [],
      cellDeps: MATCH_ORDERS_CELL_DEPS,
      inputs: [dealMakerCell.input, ...inputs],
      witnesses: [dealMakerCell.witness, ...new Array(this.matchedOrderList.length).fill('0x')],
      outputs: [dealMakerCell.output, ...outputs],
      outputsData: [dealMakerCell.data, ...outputsData],
    }
    this.minerFee = BigInt(getTransactionSize(rawTx) * 1000)
    rawTx.outputs[0].capacity = `0x${(dealMaker.capacity - this.minerFee).toString(16)}`
    return rawTx
  }

  constructor(
    bidOrderList: OrderDto[],
    askOrderList: OrderDto[],
    dealMakerCell: RawTransactionParams.Cell,
    ownerLockList: Lock[],
  ) {
    // REFACTOR: cancel this round if order is able to be claimed but lock script is not found
    this.bidOrderList = bidOrderList
      .map(order => this.#toOrder(order, ownerLockList))
      .filter(o => o?.ownerLock) as Order[]
    this.askOrderList = askOrderList
      .map(order => this.#toOrder(order, ownerLockList))
      .filter(o => o?.ownerLock) as Order[]
    this.dealMakerCell = dealMakerCell
  }

  match = (): MatchedOrder[] | [] => {
    while (
      this.askOrderList.length &&
      this.bidOrderList.length &&
      getPrice(this.askOrderList[0].price).isLessThanOrEqualTo(getPrice(this.bidOrderList[0].price))
    ) {
      const bidOrder = this.bidOrderList[0]
      const askOrder = this.askOrderList[0]

      const { bidAmount, askAmount } = formatDealInfo(bidOrder.info, askOrder.info)

      if (!askAmount.orderAmount || !askAmount.costAmount) {
        if (askOrder.part) {
          break
        }
        this.askOrderList.shift()
        continue
      }

      if (!bidAmount.orderAmount || !bidAmount.costAmount) {
        if (bidOrder.part) {
          break
        }
        this.bidOrderList.shift()
        continue
      }

      if (bidAmount.orderAmount <= askAmount.costAmount) {
        if (!this.#isBidBalanceEnough(bidAmount.balance, bidAmount.costAmount)) {
          if (bidOrder.part) {
            break
          }
          this.bidOrderList.shift()
          continue
        }

        if (bidAmount.costAmount >= askAmount.orderAmount) {
          if (!this.#isAskBalanceEnough(askAmount.balance, askAmount.costAmount)) {
            if (askOrder.part) {
              break
            }
            this.askOrderList.shift()
            continue
          }

          const dealtAmount = { capacity: askAmount.orderAmount, sudt: askAmount.costAmount }

          this.handleFullMatchedOrder(bidOrder, dealtAmount)
          this.handleFullMatchedOrder(askOrder, dealtAmount)
          continue
        }

        if (!this.#isAskBalanceEnough(askOrder.info.sudtAmount, bidAmount.orderAmount)) {
          if (askOrder.part) {
            break
          }
          this.askOrderList.shift()
          continue
        }

        const dealtAmount = { capacity: bidAmount.costAmount, sudt: bidAmount.orderAmount }
        this.handleFullMatchedOrder(bidOrder, dealtAmount)
        this.handleMatchedAskOrder(askOrder, dealtAmount)
        continue
      } else if (bidAmount.costAmount >= askAmount.orderAmount) {
        if (!this.#isAskBalanceEnough(askAmount.balance, askAmount.costAmount)) {
          if (askOrder.part) {
            break
          }
          this.askOrderList.shift()
          continue
        }

        if (!this.#isBidBalanceEnough(bidOrder.info.capacity, askAmount.orderAmount)) {
          if (bidOrder.part) {
            break
          }
          this.bidOrderList.shift()
          continue
        }

        const dealtAmount = { capacity: askAmount.orderAmount, sudt: askAmount.costAmount }
        this.handleFullMatchedOrder(askOrder, dealtAmount)
        this.handleMatchedBidOrder(bidOrder, dealtAmount)
        continue
      }

      if (this.bidOrderList.length > this.askOrderList.length) {
        this.askOrderList.shift()
      } else {
        this.bidOrderList.shift()
      }
    }

    const partialOrder = [this.bidOrderList[0], this.askOrderList[0]].find(o => o?.part)
    if (partialOrder) {
      this.matchedOrderList.push(partialOrder)
    }
    return this.matchedOrderList
  }

  handleMatchedAskOrder = (askOrder: Order, bidAmount: Record<'capacity' | 'sudt', bigint>) => {
    const price = getPrice(askOrder.price)

    const costSudt = BigInt(
      new BigNumber(
        `${bidAmount.capacity > askOrder.info.orderAmount ? askOrder.info.orderAmount : bidAmount.capacity}`,
      )
        .dividedBy(price)
        .integerValue(BigNumber.ROUND_DOWN)
        .toFormat({ groupSeparator: '' }),
    )

    const boughtCapacity = BigInt(
      new BigNumber(`${costSudt}`)
        .multipliedBy(price)
        .integerValue(BigNumber.ROUND_CEIL)
        .toFormat({ groupSeparator: '' }),
    )
    const costSudtOverflow = costSudt - bidAmount.sudt

    const rawFee = (bidAmount.sudt * FEE) / (FEE_RATIO - FEE)
    let fee = costSudtOverflow > rawFee ? costSudtOverflow : rawFee

    const orderAmount = askOrder.info.orderAmount - boughtCapacity

    let sudtAmount = askOrder.info.sudtAmount - bidAmount.sudt - fee
    if (sudtAmount < BigInt(0)) {
      fee += sudtAmount
      sudtAmount = BigInt(0)
    }

    const capacity = askOrder.info.capacity + boughtCapacity
    const info = { capacity, sudtAmount, orderAmount, price: askOrder.price, type: OrderType.Ask }
    this.dealMakerSudtAmount += fee
    this.dealMakerCapacityAmount += bidAmount.capacity - boughtCapacity
    this.askOrderList[0] = { ...askOrder, info, part: true }
  }

  handleMatchedBidOrder = (bidOrder: Order, askAmount: Record<'capacity' | 'sudt', bigint>) => {
    const price = getPrice(bidOrder.price)

    const boughtSudt = askAmount.sudt > bidOrder.info.orderAmount ? bidOrder.info.orderAmount : askAmount.sudt
    const costCapacity = BigInt(
      new BigNumber(`${boughtSudt}`)
        .multipliedBy(price)
        .integerValue(BigNumber.ROUND_DOWN)
        .toFormat({ groupSeparator: '' }),
    )

    const costCapacityOverflow = costCapacity - askAmount.capacity

    const rawFee = (askAmount.capacity * FEE) / (FEE_RATIO - FEE)
    let fee = costCapacityOverflow > rawFee ? costCapacityOverflow : rawFee

    let capacity = bidOrder.info.capacity - askAmount.capacity - fee
    const cellSize = BigInt(ORDER_CELL_SIZE) * BigInt(SHANNONS_RATIO)

    if (capacity < cellSize) {
      fee -= cellSize - capacity
      capacity = cellSize
    }

    const orderAmount = bidOrder.info.orderAmount - boughtSudt
    const sudtAmount = bidOrder.info.sudtAmount + boughtSudt
    const info = { capacity, sudtAmount, orderAmount, price: bidOrder.price, type: OrderType.Bid }
    this.dealMakerCapacityAmount += fee
    this.dealMakerSudtAmount += askAmount.sudt - boughtSudt
    this.bidOrderList[0] = { ...bidOrder, info, part: true }
  }

  handleFullMatchedOrder = (order: Order, counterpart: Record<'capacity' | 'sudt', bigint>) => {
    if (order.info.type === OrderType.Bid) {
      this.handleMatchedBidOrder(order, counterpart)
      const matched = this.bidOrderList.shift()
      this.matchedOrderList.push(matched!)
    } else {
      this.handleMatchedAskOrder(order, counterpart)
      const matched = this.askOrderList.shift()
      this.matchedOrderList.push(matched!)
    }
  }

  #toOrder = (order: OrderDto, ownerLockList: Lock[]): Order | null => {
    try {
      const output = JSON.parse(order.output)
      const info = parseOrderData(output.data)
      return {
        id: order.id,
        scripts: { lock: output.lock, type: output.type },
        price: order.price,
        info: { capacity: BigInt(output.capacity), ...info, type: +info.type },
        ownerLock: ownerLockList.find(l => l.lockHash === order.ownerLockHash) ?? null,
      }
    } catch {
      return null
    }
  }

  #isBidBalanceEnough = (balance: bigint, costAmount: bigint) => {
    return (balance - ORDER_CELL_MIN_CAPACITY) * (FEE_RATIO - FEE) >= costAmount * FEE_RATIO
  }

  #isAskBalanceEnough = (balance: bigint, costAmount: bigint) => {
    return balance * (FEE_RATIO - FEE) >= costAmount * FEE_RATIO
  }

  #isOrderClaimable = ({ orderAmount, type, capacity, sudtAmount, price }: OrderInfo) => {
    if (this.#isOrderClaimableInDemo({ orderAmount, type, capacity, sudtAmount, price })) {
      return true
    }

    if (orderAmount === BigInt(0)) {
      return true
    }

    const priceExponent = BigInt(10 ** Math.abs(Number(price.exponent)))

    if (type === OrderType.Bid) {
      const balance = capacity - BigInt(SUDT_CELL_SIZE) * BigInt(SHANNONS_RATIO)
      if (price.exponent < 0) {
        return balance * (FEE_RATIO - FEE) * priceExponent < price.effect * FEE_RATIO
      }
      return balance * (FEE_RATIO - FEE) < price.effect * priceExponent * FEE_RATIO
    }

    const balance = sudtAmount
    if (price.exponent < 0 && balance * (FEE_RATIO - FEE) * price.effect >= priceExponent * FEE_RATIO) {
      return false
    }
    return true
  }

  /**
   * Claim condition used in demo
   */
  #isOrderClaimableInDemo = (info: OrderInfo) => {
    const exponent = Number(info.price.exponent)
    const p = info.price.effect * PRICE_RATIO

    const price = exponent >= 0 ? p * BigInt(10) ** BigInt(exponent) : p / BigInt(10) ** BigInt(-1 * exponent)

    const ckbAmount = info.type === OrderType.Bid ? (info.orderAmount * price) / PRICE_RATIO : info.orderAmount
    const { sudt } = findBestDeal(ckbAmount, price)
    return !sudt
  }
}
