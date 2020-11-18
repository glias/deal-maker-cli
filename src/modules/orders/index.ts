import loadCells from '@nervosnetwork/ckb-sdk-core/lib/loadCellsFromIndexer'
import { getTransactionSize, privateKeyToPublicKey, blake160 } from '@nervosnetwork/ckb-sdk-utils'
import { Indexer, CellCollector } from '@ckb-lumos/indexer'
import type { Cell } from '@ckb-lumos/base'
import { injectable } from 'inversify'
import { getConnection } from 'typeorm'
import OrderRepository from './order.repository'
import { OrderType } from './order.entity'
import { OrderDto } from './order.dto'
import DealRepository from './deal.repository'
import {
  logger,
  getPrivateKey,
  parseOrderCell,
  parseOrderData,
  bigIntToUint128Le,
  signAndSendTransaction,
  formatOrderData,
  SECP256K1_CODE_HASH,
  FEE,
  FEE_RATIO,
  SHANNONS_RATIO,
  PRICE_RATIO,
  // parsePlaceOrderTx,
  readBigUInt128LE,
  getMatchOrdersTx,
  getMatchedOrder,
} from '../../utils'
import { Deal, DealStatus } from './deal.entity'

const logTag = `\x1b[35m[Orders Service]\x1b[0m`

@injectable()
class OrdersService {
  #info = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }
  #warn = (msg: string) => {
    logger.warn(`${logTag}: ${msg}`)
  }
  #orderRepository = getConnection(process.env.NODE_ENV).getCustomRepository(OrderRepository)
  #dealRepository = getConnection(process.env.NODE_ENV).getCustomRepository(DealRepository)

  inputCells: Array<CKBComponents.CellInput> = []
  witnesses: Array<string | CKBComponents.WitnessArgs> = []
  outputsCells: Array<CKBComponents.CellOutput> = []
  outputsData: Array<string> = []
  dealMakerCapacityAmount: bigint = BigInt(0)
  dealMakerSudtAmount: bigint = BigInt(0)

  public async prepareMatch(sudtTypeArgs: string, indexer: Indexer, keyFile: string | null): Promise<boolean> {
    const privateKey = getPrivateKey(keyFile ?? '')

    if (!privateKey) {
      this.#warn('No private key path set')
      return false
    }

    const [bidOrderList, askOrderList] = await Promise.all([
      this.getBidOrders(sudtTypeArgs),
      this.getAskOrders(sudtTypeArgs),
    ])

    if (!askOrderList.length || !bidOrderList.length) {
      this.#info('Order list is empty')
      return false
    }

    /* check live cells and add deal maker cell */
    const publicKeyHash = `0x${blake160(privateKeyToPublicKey(privateKey), 'hex')}`
    const dealMakerLock: CKBComponents.Script = { codeHash: SECP256K1_CODE_HASH, hashType: 'type', args: publicKeyHash }

    const liveCells = await loadCells({ indexer, CellCollector, lock: dealMakerLock })
    if (!liveCells.length) {
      this.#info('No live cells')
      return false
    }

    const dealMakerCells = liveCells.filter(cell => cell.type?.args === sudtTypeArgs || !cell.type)
    if (!dealMakerCells.length) {
      this.#info(`No normal cells or ${sudtTypeArgs} live cells`)
      return false
    }

    const dealMakerCell = dealMakerCells.sort((c1, c2) => Number(BigInt(c2.capacity) - BigInt(c1.capacity)))[0]

    // the core method
    const outputs = this.matchOrders(bidOrderList, askOrderList)
    if (!outputs.length) return false

    this.pushDealerMakerCellAndData(dealMakerCell, dealMakerLock)

    const rawTx = getMatchOrdersTx(this.inputCells, this.outputsCells, this.witnesses, this.outputsData)
    const minerFee = BigInt(getTransactionSize(rawTx)) * FEE_RATIO
    rawTx.outputs[0].capacity = '0x' + (BigInt(rawTx.outputs[0].capacity) - minerFee).toString(16)

    this.outputsCells[0] = rawTx.outputs[0]

    const orderIds = this.inputCells
      .map(input => `${input.previousOutput!.txHash}-${input.previousOutput!.index}`)
      .join()
    const fee = `${this.dealMakerCapacityAmount - minerFee}-${this.dealMakerSudtAmount}`
    const dealRecord = { txHash: '', tokenId: sudtTypeArgs, orderIds, fee, status: DealStatus.Pending }
    const tx = { ...rawTx, outputs: this.outputsCells }
    // if (process.env.NODE_ENV === 'development') {
    //   const orderIds = tx.inputs.slice(1).map(input => `${input.previousOutput?.txHash}-${input.previousOutput?.index}`)
    //   const inputOrders = await this.#orderRepository.findByIds(orderIds)
    //   const { bidLogs, askLogs, minerLog, delta } = parsePlaceOrderTx(
    //     {
    //       miner: {
    //         capacity: BigInt(dealMakerCell.capacity),
    //         sudtAmount: dealMakerCell.data ? BigInt('0x' + readBigUInt128LE(dealMakerCell.data.slice(2))) : BigInt(0),
    //       },
    //       orders: inputOrders.map(o => {
    //         const output = JSON.parse(o!.output)
    //         return { ...parseOrderData(output.data), capacity: BigInt(output.capacity) }
    //       }),
    //     },
    //     {
    //       miner: {
    //         capacity: BigInt(tx.outputs[0].capacity),
    //         sudtAmount: BigInt('0x' + readBigUInt128LE(tx.outputsData[0].slice(2))),
    //       },
    //       orders: tx.outputsData
    //         .slice(1)
    //         .map((data, idx) => ({ ...parseOrderData(data), capacity: BigInt(tx.outputs[idx + 1].capacity) })),
    //     },
    //   )

    //   console.table([...bidLogs, ...askLogs, minerLog])
    //   console.table(delta)
    // }

    try {
      const response = await signAndSendTransaction(tx, privateKey)
      dealRecord.txHash = response
    } catch (error) {
      this.#warn(error)
      dealRecord.status = DealStatus.Failed
    }

    this.saveDeal(dealRecord)
    this.clearGlobalVariables()
    return true
  }

  public saveOrder = (cell: Cell) => {
    const parsed = parseOrderCell(cell)
    return this.#orderRepository.saveOrder(parsed)
  }

  public removeOrder = (id: string) => {
    return this.#orderRepository.removeOrder(id)
  }

  /**
   * @param pageNo start from 0
   */
  public getAskOrders = async (args: string, pageNo = 0): Promise<OrderDto[]> => {
    const pendingOrderIds = await this.#dealRepository.getPendingOrderIds(args)
    return this.#orderRepository.getOrders(pageNo, OrderType.Ask, pendingOrderIds, args)
  }

  /**
   * @param pageNo start from 0
   */
  public getBidOrders = async (args: string, pageNo = 0): Promise<OrderDto[]> => {
    const pendingOrderIds = await this.#dealRepository.getPendingOrderIds(args)
    return this.#orderRepository.getOrders(pageNo, OrderType.Bid, pendingOrderIds, args)
  }

  public flushOrders = (cells: Array<Cell>) => {
    return this.#orderRepository.flushAllOrders(cells.map(parseOrderCell))
  }

  public clearOrders = () => {
    return this.#orderRepository.clear()
  }

  public saveDeal = (deal: Omit<Deal, 'createdAt'>) => {
    return this.#dealRepository.saveDeal(deal)
  }

  public updateDealStatus = (txHash: string, status: DealStatus) => {
    return this.#dealRepository.updateDealStatus(txHash, status)
  }

  public removeDeal = (txHash: string) => {
    return this.#dealRepository.removeDeal(txHash)
  }

  public getDeals = (pageNo: number, args: string) => {
    return this.#dealRepository.getDeals(pageNo, args)
  }

  public getPendingDeals = () => {
    return this.#dealRepository.getPendingDeals()
  }

  private matchOrders(
    bidOrderList: Array<OrderDto>,
    askOrderList: Array<OrderDto>,
  ): Array<CKBComponents.CellOutput> | [] {
    let bidMatchOrder = bidOrderList[0]
    let askMatchOrder = askOrderList[0]

    const askCapacityPrice = (askMatchOrder.price * SHANNONS_RATIO) / PRICE_RATIO
    const bidCapacityPrice = (bidMatchOrder.price * SHANNONS_RATIO) / PRICE_RATIO

    const askOrderOutput = JSON.parse(askMatchOrder.output)
    const bidOrderOutput = JSON.parse(bidMatchOrder.output)
    const bidOriginalScript = { lock: bidOrderOutput.lock, type: bidOrderOutput.type }
    const askOriginalScript = { lock: askOrderOutput.lock, type: askOrderOutput.type }

    if (askMatchOrder.price > bidMatchOrder.price) {
      let partialOrder:
        | (OrderDto & { capacity: string; data: string; lockScript: Record<'lock' | 'type', any> })
        | null = null
      if (bidMatchOrder.part) {
        partialOrder = {
          ...bidMatchOrder,
          capacity: bidOrderOutput.capacity,
          data: bidOrderOutput.data,
          lockScript: bidOriginalScript,
        }
      } else if (askMatchOrder.part) {
        partialOrder = {
          ...askMatchOrder,
          capacity: askOrderOutput.capacity,
          data: askOrderOutput.data,
          lockScript: askOriginalScript,
        }
      }
      if (partialOrder) {
        this.pushInputCells(partialOrder.id, undefined)
        this.pushOutputsCellAndData({ ...partialOrder, ...partialOrder.lockScript })
      }
      return this.outputsCells
    }

    // We calculate deal price by a simmplest strategy, use average price.After all calculation we use deal,so forget order price.
    const dealPrice = (askCapacityPrice + bidCapacityPrice) / BigInt(2)

    const { sudtAmount: bidSudtAmount, orderAmount: bidSudtOrderAmount } = parseOrderData(bidOrderOutput.data)
    const bidActualSpendCapacityAmount = (dealPrice * bidSudtOrderAmount) / SHANNONS_RATIO
    const bidOriginalCapacityAmount = BigInt(bidOrderOutput.capacity)

    const { sudtAmount: askSudtAmount, orderAmount: askCapacityOrderAmount } = parseOrderData(askOrderOutput.data)
    const askActualSpendSudtAmount = (askCapacityOrderAmount * SHANNONS_RATIO) / dealPrice
    const askOriginalCapacityAmount = BigInt(askOrderOutput.capacity)

    const bidPrice = bidMatchOrder.price
    const askPrice = askMatchOrder.price

    if (bidSudtOrderAmount === askActualSpendSudtAmount) {
      const { fee: feeForBid, ...bidDoneCapacityAndSudt } = getMatchedOrder('bid', {
        price: bidPrice,
        cost: bidActualSpendCapacityAmount,
        amount: bidSudtOrderAmount,
        spend: bidOriginalCapacityAmount,
        base: bidSudtAmount,
      })
      const { fee: feeForAsk, ...askDoneCapacityAndSudt } = getMatchedOrder('ask', {
        price: askPrice,
        cost: askActualSpendSudtAmount,
        amount: askCapacityOrderAmount,
        base: askOriginalCapacityAmount,
        spend: askSudtAmount,
      })
      this.dealMakerCapacityAmount += feeForBid
      this.dealMakerSudtAmount += feeForAsk

      this.pushInputCells(bidMatchOrder.id, bidMatchOrder.part)
      this.pushInputCells(askMatchOrder.id, askMatchOrder.part)
      this.pushOutputsCellAndData({ ...bidDoneCapacityAndSudt, ...bidOriginalScript })
      this.pushOutputsCellAndData({ ...askDoneCapacityAndSudt, ...askOriginalScript })
      bidOrderList.shift()
      askOrderList.shift()
    }

    if (bidSudtOrderAmount < askActualSpendSudtAmount) {
      const { fee: feeForBid, ...bidDoneCapacityAndSudt } = getMatchedOrder('bid', {
        price: bidPrice,
        cost: bidActualSpendCapacityAmount,
        amount: bidSudtOrderAmount,
        spend: bidOriginalCapacityAmount,
        base: bidSudtAmount,
      })
      this.dealMakerCapacityAmount += feeForBid
      const askPartlyCapacityAndSudt = this.calPartlyAskCapacityAndSudt({
        askPrice,
        bidSudtOrderAmount,
        bidActualSpendCapacityAmount,
        askOriginalCapacityAmount,
        askCapacityOrderAmount,
        askSudtAmount,
      })
      this.pushInputCells(bidMatchOrder.id, undefined)
      this.pushOutputsCellAndData({ ...bidDoneCapacityAndSudt, ...bidOriginalScript })

      const newAskOutput: OrderDto = this.generateNewOutput(askMatchOrder, askPartlyCapacityAndSudt, askOriginalScript)
      bidOrderList.shift()
      askOrderList[0] = newAskOutput
      askMatchOrder = askOrderList[0]
    }

    if (bidSudtOrderAmount > askActualSpendSudtAmount) {
      const { fee: feeForAsk, ...askDoneCapacityAndSudt } = getMatchedOrder('ask', {
        price: askMatchOrder.price,
        cost: askActualSpendSudtAmount,
        spend: askSudtAmount,
        base: askOriginalCapacityAmount,
        amount: askCapacityOrderAmount,
      })
      this.dealMakerSudtAmount += feeForAsk
      const bidPartlyCapacityAndSudt = this.calPartlyBidCapacityAndSudt({
        bidPrice: bidMatchOrder.price,
        askCapacityOrderAmount,
        bidOriginalCapacityAmount,
        bidSudtOrderAmount,
        askActualSpendSudtAmount,
        bidSudtAmount,
      })
      this.pushInputCells(askMatchOrder.id)
      this.pushOutputsCellAndData({ ...askDoneCapacityAndSudt, ...askOriginalScript })

      const newBidOutput: OrderDto = this.generateNewOutput(bidMatchOrder, bidPartlyCapacityAndSudt, bidOriginalScript)
      askOrderList.shift()
      bidOrderList[0] = newBidOutput
      bidMatchOrder = bidOrderList[0]
    }

    // Next four condtions means we can't match again, so jump out this function
    if (!bidOrderList.length && !askOrderList.length) {
      return this.outputsCells
    }

    if (!askOrderList.length && bidOrderList[0].part) {
      return this.stopMatchAndReturnOutputs(bidMatchOrder)
    }

    if (!bidOrderList.length && askOrderList[0].part) {
      return this.stopMatchAndReturnOutputs(askMatchOrder)
    }

    if (!bidOrderList.length || !askOrderList.length) {
      return this.outputsCells
    }

    return this.matchOrders(bidOrderList, askOrderList)
  }

  private pushInputCells(inputId: string, part?: boolean) {
    if (!part) {
      const previousInput: CKBComponents.CellInput = {
        previousOutput: { txHash: inputId.split('-')[0], index: inputId.split('-')[1] },
        since: '0x0',
      }
      this.inputCells.push(previousInput)
      this.witnesses.push('0x')
    }
  }

  private pushOutputsCellAndData({
    capacity,
    data,
    lock,
    type,
  }: {
    capacity: string
    data: string
    lock: { code_hash: string; hash_type: CKBComponents.ScriptHashType; args: string }
    type: { code_hash: string; hash_type: CKBComponents.ScriptHashType; args: string }
  }) {
    this.outputsCells.push({
      capacity,
      lock: { codeHash: lock.code_hash, hashType: lock.hash_type, args: lock.args },
      type: { codeHash: type.code_hash, hashType: type.hash_type, args: type.args },
    })
    this.outputsData.push(data)
  }

  private generateNewOutput(
    originalOrderCell: OrderDto,
    capacityAndSudt: Record<'capacity' | 'data', string>,
    originalScript: Record<'lock' | 'type', object>,
  ) {
    return { ...originalOrderCell, output: JSON.stringify({ ...capacityAndSudt, ...originalScript }), part: true }
  }

  private calPartlyBidCapacityAndSudt({
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
  >) {
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

  private calPartlyAskCapacityAndSudt({
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
  >) {
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

  private stopMatchAndReturnOutputs(order: OrderDto) {
    const parsedOutput = JSON.parse(order.output)
    this.pushInputCells(order.id)
    this.pushOutputsCellAndData(parsedOutput)
    return this.outputsCells
  }

  // Generate dealmaker's fee cell
  private pushDealerMakerCellAndData(cell: RawTransactionParams.Cell, lock: CKBComponents.Script) {
    this.inputCells.unshift({ previousOutput: cell.outPoint!, since: '0x0' })
    this.witnesses.unshift({ lock: '', inputType: '', outputType: '' })
    const newCapacity = this.dealMakerCapacityAmount + BigInt(cell.capacity)
    const newSudt =
      this.dealMakerSudtAmount + (cell.data ? BigInt('0x' + readBigUInt128LE(cell.data.slice(2))) : BigInt(0))
    const dealMakerCell: CKBComponents.CellOutput = { capacity: `0x${newCapacity.toString(16)}`, lock, type: cell.type }
    this.outputsCells.unshift(dealMakerCell)
    this.outputsData.unshift(`0x${bigIntToUint128Le(newSudt)}`)
  }

  private clearGlobalVariables() {
    this.inputCells = []
    this.witnesses = []
    this.outputsCells = []
    this.outputsData = []
    this.dealMakerCapacityAmount = BigInt('0')
    this.dealMakerSudtAmount = BigInt('0')
  }
}

export default OrdersService
