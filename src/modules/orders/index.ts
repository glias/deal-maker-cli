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
  MATCH_ORDERS_CELL_DEPS,
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

  /*
  This function is the entry for match engine.
  Our workflow is get sorted order list from sync module.Then match them, generate raw
  transaction, sign and send it.
  In this function we do some check to ensure our matcher can successfully work.
  Such as set private key; check order list is not empty; check deal maker have live cells etc.
  Other sync order filter conditions are define in orders/order.repository.ts toCell function.
  */
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
    const publicKey = privateKeyToPublicKey(privateKey)
    const publicKeyHash = `0x${blake160(publicKey, 'hex')}`
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
    const outputs = this.startMatchAndReturnOutputs(bidOrderList, askOrderList)
    if (!outputs.length) return false

    this.pushDealerMakerCellAndData(dealMakerCell, dealMakerLock)

    const rawTx = this.generateRawTx()
    const minerFee = BigInt(getTransactionSize(rawTx)) * FEE_RATIO
    rawTx.outputs[0].capacity = '0x' + (BigInt(rawTx.outputs[0].capacity) - minerFee).toString(16)

    this.outputsCells[0] = rawTx.outputs[0]

    const dealRecord = this.generateDeal(minerFee, sudtTypeArgs)
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

  private startMatchAndReturnOutputs(
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
      // If before we have matched some order and current order is partially matched, we need to add it to outputs.
      // handle partially matched order
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
        this.pushOutputsCellAndData(
          { capacity: partialOrder.capacity, data: partialOrder.data },
          partialOrder.lockScript,
        )
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

    /*
    We transfer ask order's ckb order amount to actual spend sudt amount,
    and then compare with bid order's sudt order amount to judge that it is full mtached or partially matched
    */
    if (bidSudtOrderAmount === askActualSpendSudtAmount) {
      // For done bid order, add order SUDT amount to current amount, and set order amount 0, then sub used capacity and fee.
      const bidDoneCapacityAndSudt: { capacity: string; data: string } = this.calDoneBidCapacityAndSudt({
        bidPrice: bidMatchOrder.price,
        bidActualSpendCapacityAmount: bidActualSpendCapacityAmount,
        bidSudtOrderAmount: bidSudtOrderAmount,
        bidOriginalCapacityAmount: bidOriginalCapacityAmount,
        bidSudtAmount: bidSudtAmount,
      })
      // Input cell, output cell, output data and witness need one to one correspondence
      this.pushInputCells(bidMatchOrder.id, bidMatchOrder.part)
      this.pushOutputsCellAndData(bidDoneCapacityAndSudt, bidOriginalScript)
      // It has been matched so remove it from order list
      bidOrderList.shift()

      // For done bid order, add order CKB amount to capacity, and set order amount 0, then sub used SUDT and fee.
      const askDoneCapacityAndSudt: { capacity: string; data: string } = this.calDoneAskCapacityAndSudt({
        askPrice: askMatchOrder.price,
        askActualSpendSudtAmount: askActualSpendSudtAmount,
        askCapacityOrderAmount: askCapacityOrderAmount,
        askOriginalCapacityAmount: askOriginalCapacityAmount,
        askSudtAmount: askSudtAmount,
      })
      this.pushInputCells(askMatchOrder.id, askMatchOrder.part)
      this.pushOutputsCellAndData(askDoneCapacityAndSudt, askOriginalScript)
      askOrderList.shift()
    } else if (bidSudtOrderAmount < askActualSpendSudtAmount) {
      const bidDoneCapacityAndSudt: { capacity: string; data: string } = this.calDoneBidCapacityAndSudt({
        bidPrice: bidMatchOrder.price,
        bidActualSpendCapacityAmount: bidActualSpendCapacityAmount,
        bidSudtOrderAmount: bidSudtOrderAmount,
        bidOriginalCapacityAmount: bidOriginalCapacityAmount,
        bidSudtAmount: bidSudtAmount,
      })

      this.pushInputCells(bidMatchOrder.id, undefined)
      this.pushOutputsCellAndData(bidDoneCapacityAndSudt, bidOriginalScript)
      bidOrderList.shift()

      // For partially matched ask order.Add matched CKB to current capacity, then sub order CKB amount and used SUDT and fee.
      const askPartlyCapacityAndSudt: { capacity: string; data: string } = this.calPartlyAskCapacityAndSudt({
        bidSudtOrderAmount: bidSudtOrderAmount,
        bidActualSpendCapacityAmount: bidActualSpendCapacityAmount,
        askOriginalCapacityAmount: askOriginalCapacityAmount,
        askCapacityOrderAmount: askCapacityOrderAmount,
        askSudtAmount: askSudtAmount,
        askPrice: askMatchOrder.price,
      })
      // Use after matched info to generate a new output
      const newAskOutput: OrderDto = this.generateNewOutput(askMatchOrder, askPartlyCapacityAndSudt, askOriginalScript)

      // Remove current ask order, and put new one to ask order list for next matched
      askOrderList[0] = newAskOutput
      askMatchOrder = askOrderList[0]
    } else {
      const askDoneCapacityAndSudt = this.calDoneAskCapacityAndSudt({
        askPrice: askMatchOrder.price,
        askActualSpendSudtAmount: askActualSpendSudtAmount,
        askSudtAmount: askSudtAmount,
        askOriginalCapacityAmount: askOriginalCapacityAmount,
        askCapacityOrderAmount: askCapacityOrderAmount,
      })
      this.pushInputCells(askMatchOrder.id, undefined)
      this.pushOutputsCellAndData(askDoneCapacityAndSudt, askOriginalScript)
      askOrderList.shift()

      // For partially matched bid order.Add matched order SUDT amount to current amount, then sub order amount and used capacity and fee.
      const bidPartlyCapacityAndSudt = this.calPartlyBidCapacityAndSudt({
        askCapacityOrderAmount: askCapacityOrderAmount,
        bidOriginalCapacityAmount: bidOriginalCapacityAmount,
        bidSudtOrderAmount: bidSudtOrderAmount,
        askActualSpendSudtAmount: askActualSpendSudtAmount,
        bidSudtAmount: bidSudtAmount,
        bidPrice: bidMatchOrder.price,
      })
      const newBidOutput: OrderDto = this.generateNewOutput(bidMatchOrder, bidPartlyCapacityAndSudt, bidOriginalScript)
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

    // recursive match function
    return this.startMatchAndReturnOutputs(bidOrderList, askOrderList)
  }

  private pushInputCells(inputId: string, part: undefined | boolean) {
    if (part === undefined) {
      const previousInput: CKBComponents.CellInput = {
        previousOutput: { txHash: inputId.split('-')[0], index: inputId.split('-')[1] },
        since: '0x0',
      }
      this.inputCells.push(previousInput)
      this.witnesses.push('0x')
    }
  }

  private calDoneBidCapacityAndSudt(args: {
    bidPrice: bigint
    bidActualSpendCapacityAmount: bigint
    bidOriginalCapacityAmount: bigint
    bidSudtAmount: bigint
    bidSudtOrderAmount: bigint
  }) {
    const bidMinerFeeCapacityAmount: bigint = (args.bidActualSpendCapacityAmount * FEE) / FEE_RATIO
    const afterMatchBidCapacity: bigint =
      args.bidOriginalCapacityAmount - args.bidActualSpendCapacityAmount - bidMinerFeeCapacityAmount
    const afterMatchBidSudtAmount: bigint = args.bidSudtAmount + args.bidSudtOrderAmount
    this.dealMakerCapacityAmount += bidMinerFeeCapacityAmount

    return {
      capacity: `0x${afterMatchBidCapacity.toString(16)}`,
      data: formatOrderData(afterMatchBidSudtAmount, BigInt('0'), args.bidPrice, '00'),
    }
  }

  private calDoneAskCapacityAndSudt(args: {
    askPrice: bigint
    askActualSpendSudtAmount: bigint
    askSudtAmount: bigint
    askOriginalCapacityAmount: bigint
    askCapacityOrderAmount: bigint
  }) {
    const askMinerFeeSudtAmount: bigint = (args.askActualSpendSudtAmount * FEE) / FEE_RATIO
    const afterMatchAskSudtAmount: bigint = args.askSudtAmount - args.askActualSpendSudtAmount - askMinerFeeSudtAmount
    const afterMatchAskCapacity = args.askOriginalCapacityAmount + args.askCapacityOrderAmount
    this.dealMakerSudtAmount += askMinerFeeSudtAmount

    return {
      capacity: `0x${afterMatchAskCapacity.toString(16)}`,
      data: formatOrderData(afterMatchAskSudtAmount, BigInt('0'), args.askPrice, '01'),
    }
  }

  private pushOutputsCellAndData(
    capacityAndSudt: Record<'capacity' | 'data', string>,
    originalScript: Record<
      'lock' | 'type',
      { code_hash: string; hash_type: CKBComponents.ScriptHashType; args: string }
    >,
  ) {
    const newOutputCell = {
      ...{ capacity: capacityAndSudt.capacity },
      ...{
        lock: {
          codeHash: originalScript.lock.code_hash,
          hashType: originalScript.lock.hash_type,
          args: originalScript.lock.args,
        },
        type: {
          codeHash: originalScript.type.code_hash,
          hashType: originalScript.type.hash_type,
          args: originalScript.type.args,
        },
      },
    }
    this.outputsCells.push(newOutputCell)
    this.outputsData.push(capacityAndSudt.data)
  }

  private generateNewOutput(
    originalOrderCell: OrderDto,
    capacityAndSudt: Record<'capacity' | 'data', string>,
    originalScript: Record<'lock' | 'type', object>,
  ) {
    return {
      ...originalOrderCell,
      output: JSON.stringify({ ...capacityAndSudt, ...originalScript }),
      part: true,
    }
  }

  private calPartlyBidCapacityAndSudt(args: {
    askCapacityOrderAmount: bigint
    bidOriginalCapacityAmount: bigint
    bidSudtOrderAmount: bigint
    askActualSpendSudtAmount: bigint
    bidSudtAmount: bigint
    bidPrice: bigint
  }) {
    const bidMinerFeeCapacityAmount: bigint = (args.askCapacityOrderAmount * FEE) / FEE_RATIO
    const afterPartMatchBidCapacity =
      args.bidOriginalCapacityAmount - args.askCapacityOrderAmount - bidMinerFeeCapacityAmount
    const afterPartMatchBidSudtOrderAmount = args.bidSudtOrderAmount - args.askActualSpendSudtAmount
    const afterPartMatchBidSudtAmount = args.bidSudtAmount + args.askActualSpendSudtAmount
    this.dealMakerCapacityAmount += bidMinerFeeCapacityAmount

    return {
      capacity: '0x' + afterPartMatchBidCapacity.toString(16),
      data: formatOrderData(afterPartMatchBidSudtAmount, afterPartMatchBidSudtOrderAmount, args.bidPrice, '00'),
    }
  }

  private calPartlyAskCapacityAndSudt(args: {
    bidSudtOrderAmount: bigint
    bidActualSpendCapacityAmount: bigint
    askOriginalCapacityAmount: bigint
    askCapacityOrderAmount: bigint
    askSudtAmount: bigint
    askPrice: bigint
  }) {
    const askMinerFeeSudtAmount: bigint = (args.bidSudtOrderAmount * FEE) / FEE_RATIO
    const afterPartMatchCapacityOrderAmount = args.askCapacityOrderAmount - args.bidActualSpendCapacityAmount
    const afterPartMatchAskSudtAmount = args.askSudtAmount - args.bidSudtOrderAmount - askMinerFeeSudtAmount
    const afterPartMatchAskCapacityAmount = args.askOriginalCapacityAmount + args.bidActualSpendCapacityAmount
    this.dealMakerSudtAmount += askMinerFeeSudtAmount

    return {
      capacity: '0x' + afterPartMatchAskCapacityAmount.toString(16),
      data: formatOrderData(afterPartMatchAskSudtAmount, afterPartMatchCapacityOrderAmount, args.askPrice, '01'),
    }
  }

  private stopMatchAndReturnOutputs(order: OrderDto) {
    const { lock, type, capacity, data } = JSON.parse(order.output)
    this.pushInputCells(order.id, undefined)
    this.pushOutputsCellAndData({ capacity, data }, { lock, type })
    return this.outputsCells
  }

  // Generate dealmaker's fee cell
  private pushDealerMakerCellAndData(cell: RawTransactionParams.Cell, lock: CKBComponents.Script) {
    this.inputCells.unshift({ previousOutput: cell.outPoint!, since: '0x0' })
    this.witnesses.unshift({
      lock: '',
      inputType: '',
      outputType: '',
    })
    const newCapacity = this.dealMakerCapacityAmount + BigInt(cell.capacity)
    const newSudt =
      this.dealMakerSudtAmount + (cell.data ? BigInt('0x' + readBigUInt128LE(cell.data.slice(2))) : BigInt(0))

    const dealMakerCell: CKBComponents.CellOutput = {
      capacity: '0x' + newCapacity.toString(16),
      lock,
      type: this.outputsCells[0].type, // should check this
    }
    this.outputsCells.unshift(dealMakerCell)
    this.outputsData.unshift(`0x${bigIntToUint128Le(newSudt)}`)
  }

  private generateRawTx() {
    const rawTransaction: CKBComponents.RawTransactionToSign = {
      version: '0x0',
      headerDeps: [],
      cellDeps: MATCH_ORDERS_CELL_DEPS,
      inputs: this.inputCells,
      witnesses: this.witnesses,
      outputs: this.outputsCells,
      outputsData: this.outputsData,
    }

    return rawTransaction
  }

  private generateDeal(minerFee: bigint, tokenId: string) {
    const orderIds = this.inputCells
      .map(input => `${input.previousOutput!.txHash}-${input.previousOutput!.index}`)
      .join()
    const fee = `${this.dealMakerCapacityAmount - minerFee}-${this.dealMakerSudtAmount}`
    return { txHash: '', tokenId, orderIds, fee, status: DealStatus.Pending }
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
