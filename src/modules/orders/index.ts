import CKB from '@nervosnetwork/ckb-sdk-core'
import { getTransactionSize } from '@nervosnetwork/ckb-sdk-utils/lib/sizes'
import { Indexer, CellCollector } from '@ckb-lumos/indexer'
import type { Cell } from '@ckb-lumos/base'
import fs from 'fs'
import { injectable } from 'inversify'
import { getConnection } from 'typeorm'
import OrderRepository from './order.repository'
import { OrderType } from './order.entity'
import { OrderDto } from './order.dto'
import DealRepository from './deal.repository'
import {
  logger,
  parseOrderCell,
  parseOrderData,
  bigIntToUint128Le,
  SUDT_TX_HASH,
  signAndSendTransaction,
  DEFAULT_NODE_URL,
  formatOrderData,
  SECP256K1_CODE_HASH,
  SECP256K1_TX_HASH,
  ORDERBOOK_TX_HASH,
  FEE,
  FEE_RATIO,
  SHANNONS_RATIO,
  PRICE_RATIO,
} from '../../utils'
import { Deal, DealStatus } from './deal.entity'
import ConfigService from '../config'

const logTag = `\x1b[35m[Orders Service]\x1b[0m`

interface CachedCell extends CKBComponents.CellIncludingOutPoint {
  status: string
  dataHash: string
  type?: CKBComponents.Script | null
}

@injectable()
class OrdersService {
  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
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
  public async prepareMatch(indexer: Indexer, sudtTypeArgs: string) {
    const ckb = new CKB(DEFAULT_NODE_URL)
    const { privateKey, dealMakerLock } = await this.calDealMakerPrivateKeyAndLock(ckb)
    if (privateKey === null || dealMakerLock === undefined) {
      this.#log('No private key path set')
      return
    }

    const bidOrderList = await this.getBidOrders(sudtTypeArgs)
    const askOrderList = await this.getAskOrders(sudtTypeArgs)
    if (askOrderList.length == 0 || bidOrderList.length == 0) {
      this.#log('Order list is empty')
      return
    }

    const outputs = this.startMatchAndReturnOutputs(bidOrderList, askOrderList)
    if (outputs.length == 0) {
      return
    }

    const liveCells = await ckb.loadCells({ indexer, CellCollector, lock: dealMakerLock })
    if (liveCells.length == 0) {
      this.#log('No live cells')
      return
    }
    function isSameSudt(cell: CachedCell) {
      return cell.type?.args == sudtTypeArgs || cell.type?.args === undefined
    }
    const sudtCells = liveCells.filter(isSameSudt)
    const biggestCell = sudtCells.sort((cell1, cell2) => Number(BigInt(cell2.capacity) - BigInt(cell1.capacity)))[0]
    if (biggestCell == undefined) {
      this.#log(`No normal cells or ${sudtTypeArgs} live cells`)
      return
    }
    this.pushDealerMakerCellAndData(biggestCell, dealMakerLock)

    const rawTx = this.generateRawTx()
    const minerFee = this.calculateMinerFee(rawTx)
    const subMinerFeeTx = this.subMinerFeeAndUpdateOutputs(rawTx, minerFee)
    const dealRecord = this.generateDealStruct(minerFee, sudtTypeArgs)
    this.sendTransactionAndSaveDeal(subMinerFeeTx, dealMakerLock, privateKey, dealRecord)
    this.clearGlobalVariables()
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

  private async calDealMakerPrivateKeyAndLock(
    ckb: CKB,
  ): Promise<{ privateKey: null | string; dealMakerLock: undefined | CKBComponents.Script }> {
    const configService = new ConfigService()
    const config = await configService.getConfig()
    if (config.keyFile === null) {
      return {
        privateKey: null,
        dealMakerLock: undefined,
      }
    }

    const privateKey = fs.readFileSync(config.keyFile, 'utf-8').trim()
    const publicKey = ckb.utils.privateKeyToPublicKey(privateKey)
    const publicKeyHash = `0x${ckb.utils.blake160(publicKey, 'hex')}`
    const dealMakerLock: CKBComponents.Script = {
      codeHash: SECP256K1_CODE_HASH,
      hashType: 'type',
      args: publicKeyHash,
    }
    return {
      privateKey,
      dealMakerLock,
    }
  }

  /*
  This function is the main match logic.
  First we need to ensure these orders are clean.So at now we focus on match.
  Match engine is design for meet user need, and we have order amount in cell data to define this need.
  So for ask order, you need to buy enough CKB amount.We don't care it's SUDT amount left.
  For bid order, you need to buy enough SUDT amount. We don't care it's ckb amount left.
  For match there have two condition: 1. full matched 2. partially matched.
  Full matched means two orders need both can be meet.
  In other words, ask order's need ckb amount is equal to bid order can pay for it's SUDT value.
  Partially matched means only one direction's need can be meet.So one order will be deal done,
  another will have left.
  */
  private startMatchAndReturnOutputs(
    bidOrderList: Array<OrderDto>,
    askOrderList: Array<OrderDto>,
  ): Array<CKBComponents.CellOutput> | [] {
    let askMatchOrder = askOrderList[0]
    let bidMatchOrder = bidOrderList[0]
    const { price: askPrice } = askMatchOrder
    const { price: bidPrice } = bidMatchOrder

    const askCapacityPrice = (askPrice * SHANNONS_RATIO) / PRICE_RATIO
    const bidCapacityPrice = (bidPrice * SHANNONS_RATIO) / PRICE_RATIO

    const askOrderOutput = JSON.parse(askMatchOrder.output)
    const bidOrderOutput = JSON.parse(bidMatchOrder.output)
    const bidOriginalScript = {
      lock: bidOrderOutput.lock,
      type: bidOrderOutput.type,
    }
    const askOriginalScript = {
      lock: askOrderOutput.lock,
      type: askOrderOutput.type,
    }

    //When ask price is greater than bid price, they can't match.
    if (askPrice > bidPrice) {
      //If before we have matched some order and current order is partially matched, we need to add it to outputs.
      if (this.outputsCells.length > 0) {
        if (bidMatchOrder.part) {
          this.pushInputCells(bidMatchOrder.id, undefined)
          this.pushOutputsCellAndData(
            { capacity: bidOrderOutput.capacity, data: bidOrderOutput.data },
            bidOriginalScript,
          )
        }

        if (askMatchOrder.part) {
          this.pushInputCells(askMatchOrder.id, undefined)
          this.pushOutputsCellAndData(
            { capacity: askOrderOutput.capacity, data: askOrderOutput.data },
            askOriginalScript,
          )
        }

        return this.outputsCells
      } else {
        this.#log('No match')
        return []
      }
    } else {
      // We calculate deal price by a simmplest strategy, use average price.After all calculation we use deal,so forget order price.
      const dealPrice: bigint = (askCapacityPrice + bidCapacityPrice) / BigInt('2')

      const bidSudtAmount: bigint = parseOrderData(bidOrderOutput.data).sudtAmount
      const bidSudtOrderAmount: bigint = parseOrderData(bidOrderOutput.data).orderAmount
      const bidActualSpendCapacityAmount: bigint = (dealPrice * bidSudtOrderAmount) / SHANNONS_RATIO
      const bidOriginalCapacityAmount: bigint = BigInt(bidOrderOutput.capacity)

      const askSudtAmount: bigint = parseOrderData(askOrderOutput.data).sudtAmount
      const askCapacityOrderAmount: bigint = parseOrderData(askOrderOutput.data).orderAmount
      const askActualSpendSudtAmount: bigint = (askCapacityOrderAmount * SHANNONS_RATIO) / dealPrice
      const askOriginalCapacityAmount: bigint = BigInt(askOrderOutput.capacity)

      /*
      We transfer ask order's ckb order amount to actual spend sudt amount,
      and then compare with bid order's sudt order amount to judge that it is full mtached or partially matched
      */
      if (bidSudtOrderAmount == askActualSpendSudtAmount) {
        // For done bid order, add order SUDT amount to current amount, and set order amount 0, then sub used capacity and fee.
        const bidDoneCapacityAndSudt: { capacity: string; data: string } = this.calDoneBidCapacityAndSudt({
          bidPrice: bidPrice,
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
          askPrice: askPrice,
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
          bidPrice: bidPrice,
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
          askPrice: askPrice,
        })
        // Use after matched info to generate a new output
        const newAskOutput: OrderDto = this.generateNewOutput(
          askMatchOrder,
          askPartlyCapacityAndSudt,
          askOriginalScript,
        )

        // Remove current ask order, and put new one to ask order list for next matched
        askOrderList.shift()
        askOrderList.unshift(newAskOutput)
        askMatchOrder = askOrderList[0]
      } else {
        const askDoneCapacityAndSudt: { capacity: string; data: string } = this.calDoneAskCapacityAndSudt({
          askPrice: askPrice,
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
          bidPrice: bidPrice,
        })
        const newBidOutput: OrderDto = this.generateNewOutput(
          bidMatchOrder,
          bidPartlyCapacityAndSudt,
          bidOriginalScript,
        )

        bidOrderList.shift()
        bidOrderList.unshift(newBidOutput)
        bidMatchOrder = bidOrderList[0]
      }

      // Next four condtions means we can't match again, so jump out this function
      if (bidOrderList.length == 0 && askOrderList.length == 0) {
        return this.outputsCells
      }

      if (askOrderList.length == 0 && bidOrderList[0].part) {
        return this.stopMatchAndReturnOutputs(bidMatchOrder)
      }

      if (bidOrderList.length == 0 && askOrderList[0].part) {
        return this.stopMatchAndReturnOutputs(askMatchOrder)
      }

      if (bidOrderList.length == 0 || askOrderList.length == 0) {
        return this.outputsCells
      }

      // recursive match function
      return this.startMatchAndReturnOutputs(bidOrderList, askOrderList)
    }
  }

  private pushInputCells(inputId: string, part: undefined | boolean) {
    if (part === undefined) {
      const previousInput: CKBComponents.CellInput = {
        previousOutput: {
          txHash: inputId.split('-')[0],
          index: inputId.split('-')[1],
        },
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
      capacity: '0x' + afterMatchBidCapacity.toString(16),
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
      capacity: '0x' + afterMatchAskCapacity.toString(16),
      data: formatOrderData(afterMatchAskSudtAmount, BigInt('0'), args.askPrice, '01'),
    }
  }

  private pushOutputsCellAndData(
    capacityAndSudt: { capacity: string; data: string },
    originalScript: {
      lock: { code_hash: string; hash_type: CKBComponents.ScriptHashType; args: string }
      type: { code_hash: string; hash_type: CKBComponents.ScriptHashType; args: string }
    },
  ) {
    const parsedLockScript = {
      codeHash: originalScript.lock.code_hash,
      hashType: originalScript.lock.hash_type,
      args: originalScript.lock.args,
    }

    const parsedTypeScript = {
      codeHash: originalScript.type.code_hash,
      hashType: originalScript.type.hash_type,
      args: originalScript.type.args,
    }

    const newOutputCell = {
      ...{ capacity: capacityAndSudt.capacity },
      ...{ lock: parsedLockScript, type: parsedTypeScript },
    }
    this.outputsCells.push(newOutputCell)
    this.outputsData.push(capacityAndSudt.data)
  }

  private generateNewOutput(
    originalOrderCell: OrderDto,
    capacityAndSudt: { capacity: string; data: string },
    originalScript: { lock: object; type: object },
  ) {
    const newOutputCell: { capacity: string; lock: object; type: object } = {
      ...capacityAndSudt,
      ...originalScript,
    }
    return { ...originalOrderCell, output: JSON.stringify(newOutputCell), part: true }
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

  private stopMatchAndReturnOutputs(orderStruct: OrderDto) {
    const orderOutput = JSON.parse(orderStruct.output)
    const originalScript = {
      lock: orderOutput.lock,
      type: orderOutput.type,
    }

    this.pushInputCells(orderStruct.id, undefined)
    this.pushOutputsCellAndData({ capacity: orderOutput.capacity, data: orderOutput.data }, originalScript)
    return this.outputsCells
  }

  // Generate dealmaker's fee cell
  private pushDealerMakerCellAndData(biggestCell: CachedCell, dealMakerLock: CKBComponents.Script) {
    this.inputCells.unshift({ previousOutput: biggestCell.outPoint!, since: '0x0' })
    this.witnesses.unshift({
      lock: '',
      inputType: '',
      outputType: '',
    })

    const dealMakerCell: CKBComponents.CellOutput = {
      capacity: '0x' + (this.dealMakerCapacityAmount + BigInt(biggestCell.capacity)).toString(16),
      lock: dealMakerLock,
      type: this.outputsCells[0].type,
    }
    this.outputsCells.unshift(dealMakerCell)
    this.outputsData.unshift(`0x${bigIntToUint128Le(this.dealMakerSudtAmount)}`)
  }

  private calculateMinerFee(rawTx: CKBComponents.RawTransactionToSign): bigint {
    return BigInt(getTransactionSize(rawTx)) * FEE_RATIO
  }

  private subMinerFeeAndUpdateOutputs(
    rawTx: CKBComponents.RawTransactionToSign,
    minerFee: bigint,
  ): CKBComponents.RawTransactionToSign {
    let dealMakerOutput: CKBComponents.Cell = rawTx.outputs[0]
    const dealMakerCapacity = '0x' + (BigInt(rawTx.outputs[0].capacity) - minerFee).toString(16)
    dealMakerOutput.capacity = dealMakerCapacity
    this.outputsCells.shift()
    this.outputsCells.unshift(dealMakerOutput)
    return { ...rawTx, outputs: this.outputsCells }
  }

  private generateRawTx() {
    const rawTransaction: CKBComponents.RawTransactionToSign = {
      version: '0x0',
      headerDeps: [],
      cellDeps: [
        {
          outPoint: {
            txHash: SUDT_TX_HASH,
            index: '0x0',
          },
          depType: 'code',
        },
        {
          outPoint: { txHash: ORDERBOOK_TX_HASH, index: '0x0' },
          depType: 'code',
        },
        {
          outPoint: { txHash: SECP256K1_TX_HASH, index: '0x0' },
          depType: 'depGroup',
        },
      ],
      inputs: this.inputCells,
      witnesses: this.witnesses,
      outputs: this.outputsCells,
      outputsData: this.outputsData,
    }

    return rawTransaction
  }

  private generateDealStruct(minerFee: bigint, arg: string) {
    const orderIds: string = this.inputCells
      .map((input: CKBComponents.CellInput) => `${input.previousOutput!.txHash}-${input.previousOutput!.index}`)
      .join()
    const fee: string = `${this.dealMakerCapacityAmount - minerFee}-${this.dealMakerSudtAmount}`
    return {
      txHash: '',
      tokenId: arg,
      orderIds: orderIds,
      fee: fee,
      status: DealStatus.Pending,
    }
  }

  private async sendTransactionAndSaveDeal(
    rawTransaction: CKBComponents.RawTransactionToSign,
    lock: CKBComponents.Script,
    privateKey: string,
    deal: { txHash: string; status: number; orderIds: string; fee: string; tokenId: string },
  ) {
    try {
      const response = await signAndSendTransaction(rawTransaction, privateKey, lock)
      deal.txHash = response
    } catch (error) {
      this.#log(error)
      deal.status = DealStatus.Failed
    }

    this.saveDeal(deal)
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
