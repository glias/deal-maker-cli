import { injectable } from 'inversify'
import { getConnection } from 'typeorm'
import type { Cell } from '@ckb-lumos/base'
import OrderRepository from './order.repository'
import { OrderType } from './order.entity'
import { OrderDto } from './order.dto'
import DealRepository from './deal.repository'
import {
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
} from '../../utils'
import { Deal, DealStatus } from './deal.entity'
import fs from 'fs'
import CKB from '@nervosnetwork/ckb-sdk-core'
import { Indexer, CellCollector } from '@ckb-lumos/indexer'
import ConfigService from '../config'

interface CachedCell extends CKBComponents.CellIncludingOutPoint {
  status: string
  dataHash: string
  type?: CKBComponents.Script | null
}
// const logTag = `\x1b[35m[Orders Service]\x1b[0m`

@injectable()
class OrdersService {
  #orderRepository = getConnection(process.env.NODE_ENV).getCustomRepository(OrderRepository)
  #dealRepository = getConnection(process.env.NODE_ENV).getCustomRepository(DealRepository)

  inputCells: Array<CKBComponents.CellInput> = []
  witnesses: Array<string | CKBComponents.WitnessArgs> = []
  outputsCells: Array<CKBComponents.CellOutput> = []
  outputsData: Array<string> = []
  dealMakerCapacityAmount: bigint = BigInt('0')
  dealMakerSudtAmount: bigint = BigInt('0')
  fee: bigint = BigInt('3')
  feeRatio: bigint = BigInt('1000')
  shannonsRatio: bigint = BigInt('100000000')
  priceRatio: bigint = BigInt('10000000000')

  public async prepareMatch(indexer: Indexer) {
    const ckb = new CKB(DEFAULT_NODE_URL)
    const { privateKey, dealMakerLock } = await this.calDealMakerPrivateKeyAndLock(ckb)
    if (privateKey === null || dealMakerLock === undefined) {
      console.info('no private key path set')
      return
    }

    const bidOrderList = await this.getBidOrders()
    const askOrderList = await this.getAskOrders()
    if (askOrderList.length == 0 || bidOrderList.length == 0) {
      console.info('Order Length is zero')
      return
    }

    const outputs = this.startMatchAndReturnOutputs(bidOrderList, askOrderList)
    if (outputs.length == 0) {
      return
    }

    //TODO: If order's fee are greater than a normal Cell's smallest capacity, maybe we dont need fetch live cells
    const liveCells = await ckb.loadCells({ indexer, CellCollector, lock: dealMakerLock })
    if (liveCells.length == 0) {
      return
    }
    const biggestCell = liveCells.sort((cell1, cell2) => Number(BigInt(cell2.capacity) - BigInt(cell1.capacity)))[0]
    this.pushDealerMakerCellAndData(biggestCell, dealMakerLock)

    const rawTx = this.generateRawTx()
    this.sendTransactionAndSaveDeal(rawTx, dealMakerLock, privateKey)
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
    const hexPublicKey = `0x${ckb.utils.blake160(publicKey, 'hex')}`
    const dealMakerLock: CKBComponents.Script = {
      codeHash: SECP256K1_CODE_HASH,
      hashType: 'type',
      args: hexPublicKey,
    }
    return {
      privateKey,
      dealMakerLock,
    }
  }

  private startMatchAndReturnOutputs(bidOrderList: Array<OrderDto>, askOrderList: Array<OrderDto>): any {
    // after match
    // 1. match all, length both 0
    // 2. ask order length 0, bidOrderList part push current cell
    // 3. ask order length 0, bidOrderList not part
    // 4. bid order length 0, askOrderList part push current cell
    // 5. bid order length 0, askOrderList not part
    // 6. ask length and bid length both not 0

    let askMatchOrder = askOrderList[0]
    let bidMatchOrder = bidOrderList[0]
    const { price: askPrice, blockNumber: askOrderBlockNum } = askMatchOrder
    const { price: bidPrice, blockNumber: bidOrderBlockNum } = bidMatchOrder

    const askCapacityPrice = (askPrice * this.shannonsRatio) / this.priceRatio
    const bidCapacityPrice = (bidPrice * this.shannonsRatio) / this.priceRatio

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

    if (askPrice > bidPrice) {
      if (this.outputsCells.length > 0) {
        if (askMatchOrder.part) {
          this.pushInputCells(bidMatchOrder.id, undefined)
          this.pushOutputsCellAndData(
            { capacity: bidOrderOutput.capacity, data: bidOrderOutput.data },
            bidOriginalScript,
          )
        }

        if (bidMatchOrder.part) {
          this.pushInputCells(askMatchOrder.id, undefined)
          this.pushOutputsCellAndData(
            { capacity: askOrderOutput.capacity, data: askOrderOutput.data },
            bidOriginalScript,
          )
        }

        return this.outputsCells
      } else {
        console.info('No match')
        return []
      }
    } else {
      const dealPrice: bigint = this.calDealPrice(
        askOrderBlockNum,
        bidOrderBlockNum,
        askCapacityPrice,
        bidCapacityPrice,
      )

      const bidSudtAmount: bigint = parseOrderData(bidOrderOutput.data).sudtAmount
      const bidSudtOrderAmount: bigint = parseOrderData(bidOrderOutput.data).orderAmount
      const bidActualSpendCapacityAmount: bigint = (dealPrice * bidSudtOrderAmount) / this.shannonsRatio
      const bidOriginalCapacityAmount: bigint = BigInt(bidOrderOutput.capacity)

      const askSudtAmount: bigint = parseOrderData(askOrderOutput.data).sudtAmount
      const askCapacityOrderAmount: bigint = parseOrderData(askOrderOutput.data).orderAmount
      const askActualSpendSudtAmount: bigint = (askCapacityOrderAmount * this.shannonsRatio) / dealPrice
      const askOriginalCapacityAmount: bigint = BigInt(askOrderOutput.capacity)

      if (bidSudtOrderAmount == askActualSpendSudtAmount) {
        console.info('full match')
        const bidDoneCapacityAndSudt: { capacity: string; data: string } = this.calDoneBidCapacityAndSudt({
          bidPrice: bidPrice,
          bidActualSpendCapacityAmount: bidActualSpendCapacityAmount,
          bidSudtOrderAmount: bidSudtOrderAmount,
          bidOriginalCapacityAmount: bidOriginalCapacityAmount,
          bidSudtAmount: bidSudtAmount,
        })
        this.pushInputCells(bidMatchOrder.id, bidMatchOrder.part)
        this.pushOutputsCellAndData(bidDoneCapacityAndSudt, bidOriginalScript)
        bidOrderList.shift()

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
        console.info('bid order full match')

        // done order
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

        const askPartlyCapacityAndSudt: { capacity: string; data: string } = this.calPartlyAskCapacityAndSudt({
          bidSudtOrderAmount: bidSudtOrderAmount,
          bidActualSpendCapacityAmount: bidActualSpendCapacityAmount,
          askOriginalCapacityAmount: askOriginalCapacityAmount,
          askCapacityOrderAmount: askCapacityOrderAmount,
          askSudtAmount: askSudtAmount,
          askPrice: askPrice,
        })
        const newAskOutput: OrderDto = this.generateNewOutput(
          askMatchOrder,
          askPartlyCapacityAndSudt,
          askOriginalScript,
        )

        askOrderList.shift()
        askOrderList.unshift(newAskOutput)
        askMatchOrder = askOrderList[0]
      } else {
        console.info('ask order full match')

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

        //part dealed order
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

      return this.startMatchAndReturnOutputs(bidOrderList, askOrderList)
    }
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
  public getAskOrders = async (pageNo = 0): Promise<OrderDto[]> => {
    const pendingOrderIds = await this.#dealRepository.getPendingOrderIds()
    return this.#orderRepository.getOrders(pageNo, OrderType.Ask, pendingOrderIds)
  }

  /**
   * @param pageNo start from 0
   */
  public getBidOrders = async (pageNo = 0): Promise<OrderDto[]> => {
    const pendingOrderIds = await this.#dealRepository.getPendingOrderIds()
    return this.#orderRepository.getOrders(pageNo, OrderType.Bid, pendingOrderIds)
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

  public getDeals = (pageNo: number) => {
    return this.#dealRepository.getDeals(pageNo)
  }

  public getPendingDeals = () => {
    return this.#dealRepository.getPendingDeals()
  }

  private calDealPrice(
    askOrderBlockNum: number,
    bidOrderBlockNum: number,
    askCapacityPrice: bigint,
    bidCapacityPrice: bigint,
  ): bigint {
    if (askOrderBlockNum == bidOrderBlockNum) {
      return (askCapacityPrice + bidCapacityPrice) / BigInt('2')
    } else {
      return askOrderBlockNum > bidOrderBlockNum ? bidCapacityPrice : askCapacityPrice
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
    const bidMinerFeeCapacityAmount: bigint = (args.bidActualSpendCapacityAmount * this.fee) / this.feeRatio
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
    const askMinerFeeSudtAmount: bigint = (args.askActualSpendSudtAmount * this.fee) / this.feeRatio
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
      ...{ capacity: capacityAndSudt.capacity },
      ...originalScript,
      ...{ data: capacityAndSudt.data },
    }
    return { ...originalOrderCell, ...{ output: JSON.stringify(newOutputCell) }, ...{ part: true } }
  }

  private calPartlyBidCapacityAndSudt(args: {
    askCapacityOrderAmount: bigint
    bidOriginalCapacityAmount: bigint
    bidSudtOrderAmount: bigint
    askActualSpendSudtAmount: bigint
    bidSudtAmount: bigint
    bidPrice: bigint
  }) {
    const bidMinerFeeCapacityAmount: bigint = (args.askCapacityOrderAmount * this.fee) / this.feeRatio
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
    const askMinerFeeSudtAmount: bigint = (args.bidSudtOrderAmount * this.fee) / this.feeRatio
    const afterPartMatchCapacityOrderCkbAmount = args.askCapacityOrderAmount - args.bidActualSpendCapacityAmount
    const afterPartMatchAskSudtAmount = args.askSudtAmount - args.bidSudtOrderAmount - askMinerFeeSudtAmount
    const afterPartMatchAskCapacityAmount = args.askOriginalCapacityAmount + args.bidActualSpendCapacityAmount
    this.dealMakerSudtAmount += askMinerFeeSudtAmount

    return {
      capacity: '0x' + afterPartMatchAskCapacityAmount.toString(16),
      data: formatOrderData(afterPartMatchAskSudtAmount, afterPartMatchCapacityOrderCkbAmount, args.askPrice, '01'),
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

  private pushDealerMakerCellAndData(biggestCell: CachedCell, dealMakerLock: CKBComponents.Script) {
    this.inputCells.unshift({ previousOutput: biggestCell.outPoint!, since: '0x0' })
    this.witnesses.unshift({
      lock: '',
      inputType: '',
      outputType: '',
    })

    const dealMakerCell: CKBComponents.CellOutput = {
      capacity: '0x' + (this.dealMakerCapacityAmount + BigInt(biggestCell.capacity) - this.calMinerFee()).toString(16),
      lock: dealMakerLock,
      type: this.outputsCells[0].type,
    }
    this.outputsCells.unshift(dealMakerCell)
    this.outputsData.unshift(`0x${bigIntToUint128Le(this.dealMakerSudtAmount)}`)
  }

  private calMinerFee(): bigint {
    return BigInt(10000)
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

  private async sendTransactionAndSaveDeal(
    rawTransaction: CKBComponents.RawTransactionToSign,
    lock: CKBComponents.Script,
    privateKey: string,
  ) {
    const orderIds: string = this.inputCells
      .map((input: CKBComponents.CellInput) => `${input.previousOutput!.txHash}-${input.previousOutput!.index}`)
      .join()
    const fee: string = `${this.dealMakerCapacityAmount - BigInt('10000')}-${this.dealMakerSudtAmount}`
    let deal = {
      txHash: '',
      orderIds: orderIds,
      fee: fee,
      status: DealStatus.Pending,
    }

    try {
      const response = await signAndSendTransaction(rawTransaction, privateKey, lock)
      deal.txHash = response

      console.info('==============================')
      console.info(response)
    } catch (error) {
      console.info('==============================')
      console.info(error)
      deal.status = DealStatus.Failed
    }

    this.saveDeal(deal)
    this.clearGlobalVariables()
  }

  private clearGlobalVariables() {
    this.inputCells = []
    this.witnesses = []
    this.outputsCells = []
    this.outputsData = []
    this.dealMakerCapacityAmount = BigInt('0')
  }
}

export default OrdersService
