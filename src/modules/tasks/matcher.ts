import { getTransactionSize } from '@nervosnetwork/ckb-sdk-utils'
import { OrderDto } from '../orders/order.dto'
import { OrderType } from '../orders/order.entity'
import {
  parseOrderData,
  formatDealInfo,
  formatOrderData,
  readBigUInt128LE,
  FEE,
  FEE_RATIO,
  MATCH_ORDERS_CELL_DEPS,
  bigIntToUint128Le,
} from '../../utils'

type OrderInfo = Record<'capacity' | 'sudtAmount' | 'orderAmount' | 'price', bigint> & { type: OrderType }
type Scripts = Record<'lock' | 'type', CKBComponents.Script>

interface MatchedOrder {
  id: string
  scripts: Scripts
  info: OrderInfo
}

interface Order extends MatchedOrder {
  price: bigint
  part?: boolean
}

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
        formatOrderData(
          o.info.sudtAmount,
          o.info.orderAmount,
          o.info.price,
          o.info.type === OrderType.Bid ? '00' : '01',
        ),
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
        (this.dealMakerCell.data ? BigInt('0x' + readBigUInt128LE(this.dealMakerCell.data.slice(2))) : BigInt(0)),
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
    this.minerFee = BigInt(getTransactionSize(rawTx)) * FEE_RATIO
    rawTx.outputs[0].capacity = `0x${(dealMaker.capacity - this.minerFee).toString(16)}`
    return rawTx
  }

  constructor(bidOrderList: OrderDto[], askOrderList: OrderDto[], dealMakerCell: RawTransactionParams.Cell) {
    this.bidOrderList = bidOrderList.map(this.#toOrder).filter(o => o) as Order[]
    this.askOrderList = askOrderList.map(this.#toOrder).filter(o => o) as Order[]
    this.dealMakerCell = dealMakerCell
  }

  match = (): MatchedOrder[] | [] => {
    while (
      this.askOrderList.length &&
      this.bidOrderList.length &&
      this.askOrderList[0].price <= this.bidOrderList[0].price
    ) {
      const bidOrder = this.bidOrderList.shift()!
      const askOrder = this.askOrderList.shift()!

      const { bidAmount, askAmount } = formatDealInfo(bidOrder.info, askOrder.info)

      if (askAmount.orderAmount === BigInt(0)) {
        this.bidOrderList.unshift(bidOrder)
        continue
      }

      if (bidAmount.orderAmount === BigInt(0)) {
        this.askOrderList.unshift(askOrder)
        continue
      }

      if (bidAmount.orderAmount === askAmount.costAmount) {
        this.handleFullMatchedOrder(bidOrder, bidAmount)
        this.handleFullMatchedOrder(askOrder, askAmount)
        continue
      }

      if (bidAmount.orderAmount < askAmount.costAmount) {
        this.handleFullMatchedOrder(bidOrder, bidAmount)
        this.handlePartialMatchedAskOrder(askOrder, { capacity: bidAmount.costAmount, sudt: bidAmount.orderAmount })
        continue
      }

      if (bidAmount.orderAmount > askAmount.costAmount) {
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
    const fee = (dealtAmount.sudt * FEE) / FEE_RATIO
    const orderAmount = askOrder.info.orderAmount - dealtAmount.capacity
    const sudtAmount = askOrder.info.sudtAmount - dealtAmount.sudt - fee
    const capacity = askOrder.info.capacity + dealtAmount.capacity
    const info = { capacity, sudtAmount, orderAmount, price: askOrder.price, type: OrderType.Ask }
    this.askOrderList.unshift({ ...askOrder, info, part: true })
    this.dealMakerSudtAmount += fee
  }

  handlePartialMatchedBidOrder = (bidOrder: Order, dealtAmount: Record<'capacity' | 'sudt', bigint>) => {
    const fee = (dealtAmount.capacity * FEE) / FEE_RATIO
    const capacity = bidOrder.info.capacity - dealtAmount.capacity - fee
    const orderAmount = bidOrder.info.orderAmount - dealtAmount.sudt
    const sudtAmount = bidOrder.info.sudtAmount + dealtAmount.sudt
    const info = { capacity, sudtAmount, orderAmount, price: bidOrder.price, type: OrderType.Bid }
    this.bidOrderList.unshift({ ...bidOrder, info, part: true })
    this.dealMakerCapacityAmount += fee
  }

  handleFullMatchedOrder = (
    order: Order,
    { costAmount, balance, targetAmount }: Record<'costAmount' | 'balance' | 'targetAmount', bigint>,
  ) => {
    const fee = (costAmount * FEE) / FEE_RATIO
    const remain = balance - costAmount - fee
    if (order.info.type === OrderType.Bid) {
      this.dealMakerCapacityAmount += fee
      this.matchedOrderList.push({
        id: order.id,
        scripts: order.scripts,
        info: {
          sudtAmount: targetAmount,
          orderAmount: BigInt(0),
          price: order.price,
          capacity: remain,
          type: OrderType.Bid,
        },
      })
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
    }
  }

  #toOrder = (order: OrderDto): Order | null => {
    try {
      const output = JSON.parse(order.output)
      const info = parseOrderData(output.data)
      return {
        id: order.id,
        scripts: { lock: output.lock, type: output.type },
        price: order.price,
        info: { capacity: BigInt(output.capacity), ...info, type: +info.type },
      }
    } catch {
      return null
    }
  }
}
