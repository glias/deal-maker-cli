import { OrderDto } from '../modules/orders/order.dto'
import { OrderType } from '../modules/orders/order.entity'
import { parseOrderData, formatOrderData, FEE, FEE_RATIO, SHANNONS_RATIO, PRICE_RATIO } from '../utils'

interface MatchedOrder {
  id: string
  scripts: Record<'lock' | 'type', any>
  info: Record<'capacity' | 'sudtAmount' | 'orderAmount' | 'price', bigint> & { type: '00' | '01' }
}

export default class {
  inputCells: Array<CKBComponents.CellInput> = []
  matchedOrderList: Array<MatchedOrder> = []
  bidOrderList: OrderDto[]
  askOrderList: OrderDto[]
  dealMakerCapacityAmount: bigint = BigInt(0)
  dealMakerSudtAmount: bigint = BigInt(0)
  dealMakerCell: RawTransactionParams.Cell

  constructor(bidOrderList: OrderDto[], askOrderList: OrderDto[], dealMakerCell: RawTransactionParams.Cell) {
    this.bidOrderList = bidOrderList
    this.askOrderList = askOrderList
    this.dealMakerCell = dealMakerCell
  }

  match = (): MatchedOrder[] | [] => {
    let bidMatchOrder = this.bidOrderList[0]
    let askMatchOrder = this.askOrderList[0]

    const askCapacityPrice = (askMatchOrder.price * SHANNONS_RATIO) / PRICE_RATIO
    const bidCapacityPrice = (bidMatchOrder.price * SHANNONS_RATIO) / PRICE_RATIO

    const askOrderOutput = JSON.parse(askMatchOrder.output)
    const bidOrderOutput = JSON.parse(bidMatchOrder.output)
    const bidOriginalScript = { lock: bidOrderOutput.lock, type: bidOrderOutput.type }
    const askOriginalScript = { lock: askOrderOutput.lock, type: askOrderOutput.type }

    if (askMatchOrder.price > bidMatchOrder.price) {
      let partialOrder: (OrderDto & { capacity: string; data: string; lock: any; type: any }) | null = null
      if (bidMatchOrder.part) {
        partialOrder = {
          ...bidMatchOrder,
          capacity: bidOrderOutput.capacity,
          data: bidOrderOutput.data,
          ...bidOriginalScript,
        }
      } else if (askMatchOrder.part) {
        partialOrder = {
          ...askMatchOrder,
          capacity: askOrderOutput.capacity,
          data: askOrderOutput.data,
          ...askOriginalScript,
        }
      }
      if (partialOrder) {
        this.pushCell({
          // id: partialOrder.id,
          // lock: partialOrder.lock,
          // type: partialOrder.type,
          // part: partialOrder.part,
          ...partialOrder,
          info: { ...parseOrderData(partialOrder.data), capacity: BigInt(partialOrder.capacity) },
        })
      }
      return this.matchedOrderList
    }

    // We calculate deal price by a simmplest strategy, use average price.After all calculation we use deal,so forget order price.
    const dealPrice = (askCapacityPrice + bidCapacityPrice) / BigInt(2)

    const { sudtAmount: bidSudtAmount, orderAmount: bidSudtOrderAmount } = parseOrderData(bidOrderOutput.data)
    const { sudtAmount: askSudtAmount, orderAmount: askCapacityOrderAmount } = parseOrderData(askOrderOutput.data)

    const bidData = {
      price: bidMatchOrder.price,
      cost: (dealPrice * bidSudtOrderAmount) / SHANNONS_RATIO,
      amount: bidSudtOrderAmount,
      spend: BigInt(bidOrderOutput.capacity),
      base: bidSudtAmount,
    }
    const askData = {
      price: askMatchOrder.price,
      cost: (askCapacityOrderAmount * SHANNONS_RATIO) / dealPrice,
      amount: askCapacityOrderAmount,
      base: BigInt(askOrderOutput.capacity),
      spend: askSudtAmount,
    }

    if (bidSudtOrderAmount === askData.cost) {
      this.handleFullMatchedOrder({ ...bidMatchOrder, scripts: bidOriginalScript }, bidData)
      this.handleFullMatchedOrder({ ...askMatchOrder, scripts: askOriginalScript }, askData)
    }

    if (bidSudtOrderAmount < askData.cost) {
      this.handleFullMatchedOrder({ ...bidMatchOrder, part: undefined, scripts: bidOriginalScript }, bidData)
      const askPartlyCapacityAndSudt = this.calPartlyAskCapacityAndSudt({
        askPrice: askData.price,
        bidSudtOrderAmount,
        bidActualSpendCapacityAmount: bidData.cost,
        askOriginalCapacityAmount: askData.base,
        askCapacityOrderAmount,
        askSudtAmount,
      })

      const newAskOutput: OrderDto = this.generateNewOutput(askMatchOrder, askPartlyCapacityAndSudt, askOriginalScript)
      this.askOrderList[0] = newAskOutput
      askMatchOrder = this.askOrderList[0]
    }

    if (bidSudtOrderAmount > askData.cost) {
      this.handleFullMatchedOrder({ ...askMatchOrder, scripts: askOriginalScript }, askData)
      const bidPartlyCapacityAndSudt = this.calPartlyBidCapacityAndSudt({
        bidPrice: bidMatchOrder.price,
        askCapacityOrderAmount,
        bidOriginalCapacityAmount: bidData.spend,
        bidSudtOrderAmount,
        askActualSpendSudtAmount: askData.cost,
        bidSudtAmount,
      })

      const newBidOutput: OrderDto = this.generateNewOutput(bidMatchOrder, bidPartlyCapacityAndSudt, bidOriginalScript)
      this.bidOrderList[0] = newBidOutput
      bidMatchOrder = this.bidOrderList[0]
    }

    // Next four condtions means we can't match again, so jump out this function
    if (!this.bidOrderList.length && !this.askOrderList.length) {
      return this.matchedOrderList
    }

    if (!this.askOrderList.length && this.bidOrderList[0].part) {
      return this.stopMatchAndReturnOutputs(bidMatchOrder)
    }

    if (!this.bidOrderList.length && this.askOrderList[0].part) {
      return this.stopMatchAndReturnOutputs(askMatchOrder)
    }

    if (!this.bidOrderList.length || !this.askOrderList.length) {
      return this.matchedOrderList
    }

    return this.match()
  }

  pushCell = ({
    id,
    part,
    lock,
    type,
    info,
  }: {
    id: string
    part?: boolean
    lock: { code_hash: string; hash_type: CKBComponents.ScriptHashType; args: string }
    type: { code_hash: string; hash_type: CKBComponents.ScriptHashType; args: string }
    info: ReturnType<typeof parseOrderData> & { capacity: bigint }
  }) => {
    if (!part) {
      const [txHash, index] = id.split('-')
      const previousInput: CKBComponents.CellInput = {
        previousOutput: { txHash, index },
        since: '0x0',
      }
      this.inputCells.push(previousInput)
    }
    this.matchedOrderList.push({
      id,
      scripts: {
        lock: { codeHash: lock.code_hash, hashType: lock.hash_type, args: lock.args },
        type: { codeHash: type.code_hash, hashType: type.hash_type, args: type.args },
      },
      info,
    })
  }

  generateNewOutput = (
    originalOrderCell: OrderDto,
    capacityAndSudt: Record<'capacity' | 'data', string>,
    originalScript: Record<'lock' | 'type', object>,
  ) => {
    return { ...originalOrderCell, output: JSON.stringify({ ...capacityAndSudt, ...originalScript }), part: true }
  }

  calPartlyBidCapacityAndSudt = ({
    askCapacityOrderAmount,
    bidOriginalCapacityAmount,
    bidSudtAmount,
    bidSudtOrderAmount,
    askActualSpendSudtAmount,
    bidPrice,
  }: Record<
    | 'askCapacityOrderAmount'
    | 'bidOriginalCapacityAmount'
    | 'bidSudtOrderAmount'
    | 'askActualSpendSudtAmount'
    | 'bidSudtAmount'
    | 'bidPrice',
    bigint
  >) => {
    const bidMinerFeeCapacityAmount = (askCapacityOrderAmount * FEE) / FEE_RATIO
    const afterPartMatchBidCapacity = bidOriginalCapacityAmount - askCapacityOrderAmount - bidMinerFeeCapacityAmount
    const afterPartMatchBidSudtOrderAmount = bidSudtOrderAmount - askActualSpendSudtAmount
    const afterPartMatchBidSudtAmount = bidSudtAmount + askActualSpendSudtAmount
    this.dealMakerCapacityAmount += bidMinerFeeCapacityAmount

    return {
      capacity: `0x${afterPartMatchBidCapacity.toString(16)}`,
      data: formatOrderData(afterPartMatchBidSudtAmount, afterPartMatchBidSudtOrderAmount, bidPrice, '00'),
    }
  }

  calPartlyAskCapacityAndSudt = ({
    bidSudtOrderAmount,
    askCapacityOrderAmount,
    bidActualSpendCapacityAmount,
    askSudtAmount,
    askOriginalCapacityAmount,
    askPrice,
  }: Record<
    | 'bidSudtOrderAmount'
    | 'bidActualSpendCapacityAmount'
    | 'askOriginalCapacityAmount'
    | 'askCapacityOrderAmount'
    | 'askSudtAmount'
    | 'askPrice',
    bigint
  >) => {
    const askMinerFeeSudtAmount = (bidSudtOrderAmount * FEE) / FEE_RATIO
    const afterPartMatchCapacityOrderAmount = askCapacityOrderAmount - bidActualSpendCapacityAmount
    const afterPartMatchAskSudtAmount = askSudtAmount - bidSudtOrderAmount - askMinerFeeSudtAmount
    const afterPartMatchAskCapacityAmount = askOriginalCapacityAmount + bidActualSpendCapacityAmount
    this.dealMakerSudtAmount += askMinerFeeSudtAmount

    return {
      capacity: `0x${afterPartMatchAskCapacityAmount.toString(16)}`,
      data: formatOrderData(afterPartMatchAskSudtAmount, afterPartMatchCapacityOrderAmount, askPrice, '01'),
    }
  }

  stopMatchAndReturnOutputs = (order: OrderDto) => {
    const parsedOutput = JSON.parse(order.output) // data, capacity, lock, type
    this.pushCell({
      id: order.id,
      lock: parsedOutput.lock,
      type: parsedOutput.type,
      info: { ...parseOrderData(parsedOutput.data), capacity: BigInt(parsedOutput.capacity) },
    })
    return this.matchedOrderList
  }

  // Generate dealmaker's fee cell
  // private pushDealerMakerCellAndData(cell: RawTransactionParams.Cell, lock: CKBComponents.Script) {
  //   this.inputCells.unshift({ previousOutput: cell.outPoint!, since: '0x0' })
  //   this.witnesses.unshift({ lock: '', inputType: '', outputType: '' })
  //   const newCapacity = this.dealMakerCapacityAmount + BigInt(cell.capacity)
  //   const newSudt =
  //     this.dealMakerSudtAmount + (cell.data ? BigInt('0x' + readBigUInt128LE(cell.data.slice(2))) : BigInt(0))
  //   const dealMakerCell: CKBComponents.CellOutput = { capacity: `0x${newCapacity.toString(16)}`, lock, type: cell.type }
  //   this.outputsCells.unshift(dealMakerCell)
  //   this.outputsData.unshift(`0x${bigIntToUint128Le(newSudt)}`)
  // }
  handleFullMatchedOrder = (
    { id, part, type, scripts }: Pick<OrderDto, 'id' | 'part' | 'type'> & { scripts: any },
    { cost, spend, amount, base, price }: Record<'price' | 'cost' | 'spend' | 'base' | 'amount', bigint>,
  ) => {
    const fee = (cost * FEE) / FEE_RATIO
    const remain = spend - cost - fee
    const final = base + amount
    if (type === OrderType.Bid) {
      this.dealMakerCapacityAmount += fee
      this.pushCell({
        id,
        part,
        ...scripts,
        info: {
          sudtAmount: final,
          orderAmount: BigInt(0),
          price,
          capacity: remain,
          type: '00',
        },
      })
      this.bidOrderList.shift()
    } else {
      this.dealMakerSudtAmount += fee
      this.pushCell({
        id,
        part,
        ...scripts,
        info: {
          sudtAmount: remain,
          orderAmount: BigInt(0),
          price,
          capacity: final,
          type: '01',
        },
      })
      this.askOrderList.shift()
    }
  }
}
