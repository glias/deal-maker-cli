import { getTransactionSize } from '@nervosnetwork/ckb-sdk-utils'
import { OrderDto } from '../orders/order.dto'
import { OrderType } from '../orders/order.entity'
import {
  parseOrderData,
  formatDealInfo,
  encodeOrderData,
  readBigUInt128LE,
  FEE,
  FEE_RATIO,
  MATCH_ORDERS_CELL_DEPS,
  bigIntToUint128Le,
  ORDER_CELL_SIZE,
  SHANNONS_RATIO,
} from '../../utils'
import { Lock } from '../locks/lock.entity'

type Price = Record<'effect' | 'exponent', bigint>
type OrderInfo = Record<'capacity' | 'sudtAmount' | 'orderAmount', bigint> & { type: OrderType; price: Price }
type Scripts = Record<'lock' | 'type', CKBComponents.Script>

interface MatchedOrder {
  id: string
  scripts: Scripts
  info: OrderInfo
}

interface Order extends MatchedOrder {
  ownerLock: Lock | null
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
    this.bidOrderList = bidOrderList.map(order => this.#toOrder(order, ownerLockList)).filter(o => o) as Order[]
    this.askOrderList = askOrderList.map(order => this.#toOrder(order, ownerLockList)).filter(o => o) as Order[]
    this.dealMakerCell = dealMakerCell
  }

  match = (): MatchedOrder[] | [] => {
    while (
      this.askOrderList.length &&
      this.bidOrderList.length &&
      this.askOrderList[0].price <= this.bidOrderList[0].price
    ) {
      const bidOrder = this.bidOrderList[0]
      const askOrder = this.askOrderList[0]

      const { bidAmount, askAmount } = formatDealInfo(bidOrder.info, askOrder.info)

      // REFACTOR: cancel this round if order is able to be claimed but lock script is not found
      if (!askOrder.ownerLock) {
        this.askOrderList.shift()
        continue
      }
      if (!bidOrder.ownerLock) {
        this.bidOrderList.shift()
        continue
      }

      if (!askAmount.orderAmount || !askAmount.costAmount) {
        this.askOrderList.shift()
        continue
      }

      if (!bidAmount.orderAmount || !bidAmount.costAmount) {
        this.bidOrderList.shift()
        continue
      }

      if (bidAmount.orderAmount === askAmount.costAmount) {
        if (!this.#isBidBalanceEnough(bidAmount.balance, bidAmount.costAmount)) {
          if (bidOrder.part) {
            break
          }
          this.bidOrderList.shift()
          continue
        }

        if (!this.#isAskBalanceEnough(askAmount.balance, askAmount.costAmount)) {
          if (askOrder.part) {
            break
          }
          this.askOrderList.shift()
          continue
        }

        this.handleFullMatchedOrder(bidOrder, bidAmount)
        this.handleFullMatchedOrder(askOrder, askAmount)
        continue
      }

      if (bidAmount.orderAmount < askAmount.costAmount) {
        if (!this.#isBidBalanceEnough(bidAmount.balance, bidAmount.costAmount)) {
          if (bidOrder.part) {
            break
          }
          this.bidOrderList.shift()
          continue
        }

        if (!this.#isAskBalanceEnough(askOrder.info.sudtAmount, bidAmount.orderAmount)) {
          if (askOrder.part) {
            break
          }
          this.askOrderList.shift()
          continue
        }

        this.handleFullMatchedOrder(bidOrder, bidAmount)
        this.handlePartialMatchedAskOrder(askOrder, { capacity: bidAmount.costAmount, sudt: bidAmount.orderAmount })
        continue
      }

      if (bidAmount.orderAmount > askAmount.costAmount) {
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

        this.handleFullMatchedOrder(askOrder, askAmount)
        this.handlePartialMatchedBidOrder(bidOrder, { capacity: askAmount.orderAmount, sudt: askAmount.costAmount })
        continue
      }
    }

    const partialOrder = [this.bidOrderList[0], this.askOrderList[0]].find(o => o?.part)
    if (partialOrder) {
      this.matchedOrderList.push(partialOrder)
    }
    return this.matchedOrderList
  }

  handlePartialMatchedAskOrder = (askOrder: Order, dealtAmount: Record<'capacity' | 'sudt', bigint>) => {
    const fee = (dealtAmount.sudt * FEE) / (FEE_RATIO - FEE)
    const orderAmount = askOrder.info.orderAmount - dealtAmount.capacity
    const sudtAmount = askOrder.info.sudtAmount - dealtAmount.sudt - fee
    const capacity = askOrder.info.capacity + dealtAmount.capacity
    const info = { capacity, sudtAmount, orderAmount, price: askOrder.price, type: OrderType.Ask }
    this.askOrderList[0] = { ...askOrder, info, part: true }
    this.dealMakerSudtAmount += fee
  }

  handlePartialMatchedBidOrder = (bidOrder: Order, dealtAmount: Record<'capacity' | 'sudt', bigint>) => {
    const fee = (dealtAmount.capacity * FEE) / (FEE_RATIO - FEE)
    const capacity = bidOrder.info.capacity - dealtAmount.capacity - fee
    const orderAmount = bidOrder.info.orderAmount - dealtAmount.sudt
    const sudtAmount = bidOrder.info.sudtAmount + dealtAmount.sudt
    const info = { capacity, sudtAmount, orderAmount, price: bidOrder.price, type: OrderType.Bid }
    this.bidOrderList[0] = { ...bidOrder, info, part: true }
    this.dealMakerCapacityAmount += fee
  }

  handleFullMatchedOrder = (
    order: Order,
    { costAmount, balance, targetAmount }: Record<'costAmount' | 'balance' | 'targetAmount', bigint>,
  ) => {
    const fee = (costAmount * FEE) / (FEE_RATIO - FEE)
    const remain = balance - costAmount - fee
    if (order.info.type === OrderType.Bid) {
      this.dealMakerCapacityAmount += fee
      this.matchedOrderList.push({
        id: order.id,
        scripts: order.scripts,
        info: {
          sudtAmount: targetAmount,
          orderAmount: order.info.orderAmount + order.info.sudtAmount - targetAmount,
          price: order.price,
          capacity: remain,
          type: OrderType.Bid,
        },
      })
      this.bidOrderList.shift()
    } else {
      this.dealMakerSudtAmount += fee
      this.matchedOrderList.push({
        id: order.id,
        scripts: order.scripts,
        info: {
          sudtAmount: remain,
          orderAmount: order.info.orderAmount + order.info.capacity - targetAmount,
          price: order.price,
          capacity: targetAmount,
          type: OrderType.Ask,
        },
      })
      this.askOrderList.shift()
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
}
