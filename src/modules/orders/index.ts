import { injectable } from 'inversify'
import { getConnection } from 'typeorm'
import type { Cell } from '@ckb-lumos/base'
import { toUint64Le } from '@nervosnetwork/ckb-sdk-utils/lib/convertors'
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
  PRIVATE_KEY_PATH,
  DEFAULT_NODE_URL,
} from '../../utils'
import { Deal, DealStatus } from './deal.entity'
import fs from 'fs'
import CKB from '@nervosnetwork/ckb-sdk-core'
import { Indexer } from '@ckb-lumos/indexer'

const logTag = `\x1b[35m[Orders Service]\x1b[0m`

@injectable()
class OrdersService {
  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }

  #orderRepository = getConnection(process.env.NODE_ENV).getCustomRepository(OrderRepository)
  #dealRepository = getConnection(process.env.NODE_ENV).getCustomRepository(DealRepository)

  inputCells: Array<CKBComponents.CellInput> = []
  witnesses: Array<string> = []
  outputsCells: Array<CKBComponents.CellOutput> = []
  outputsData: Array<string> = []
  dealMakerCapacityAmount: bigint = BigInt('0')
  dealMakerSudtAmount: bigint = BigInt('0')
  fee: bigint = BigInt('3')
  feeRatio: bigint = BigInt('1000')
  shannonsRatio: bigint = BigInt('100000000')
  priceRatio: bigint = BigInt('10000000000')
  dealMakerPublicKey: string = '0x688327ab52c054a99b30f2287de0f5ee67805ded'
  privateKey: string = ''
  currentIndexer: any

  public async prepareMatch(indexer: Indexer) {
    const ckb = new CKB(DEFAULT_NODE_URL)
    this.privateKey = fs.readFileSync(PRIVATE_KEY_PATH).toString()
    this.dealMakerPublicKey = ckb.utils.privateKeyToPublicKey(this.privateKey)
    this.currentIndexer = indexer
    // const args = `0x${ckb.utils.blake160(publicKey, 'hex')}`
    // const { secp256k1Dep } = await ckb.loadDeps()
    // const lockScript = { ...secp256k1Dep, args: args }
    // const address = ckb.utils.pubkeyToAddress(publicKey)

    const askOrderList = await this.getAskOrders()
    const bidOrderList = await this.getBidOrders()

    const dealMakerLockScript: CKBComponents.Script = {
      codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
      hashType: 'type',
      args: this.dealMakerPublicKey,
    }

    if (askOrderList.length == 0 || bidOrderList.length == 0) {
      return
    }

    const outputs = this.match(askOrderList, bidOrderList)
    if (outputs.length > 0) {
      this.generateRawTxAndSend(dealMakerLockScript)
    }
  }

  public match(askOrderList: Array<OrderDto>, bidOrderList: Array<OrderDto>): any {
    // after match
    // 1. match all, length both 0
    // 2. ask order length 0, bidOrderList part push current cell
    // 3. ask order length 0, bidOrderList not part
    // 4. bid order length 0, askOrderList part push current cell
    // 5. bid order length 0, askOrderList not part
    // 6. ask length and bid length both not 0

    const askMatchOrder = askOrderList[0]
    const bidMatchOrder = bidOrderList[0]
    const { price: askPrice, blockNumber: askOrderBlockNum } = askMatchOrder
    const askOrderStruct = askMatchOrder
    const { price: bidPrice, blockNumber: bidOrderBlockNum } = bidMatchOrder
    const bidOrderStruct = bidMatchOrder
    const askCapacityPrice = (askPrice * this.shannonsRatio) / this.priceRatio
    const bidCapacityPrice = (bidPrice * this.shannonsRatio) / this.priceRatio
    const askOrderOutput = JSON.parse(askOrderStruct.output)
    const bidOrderOutput = JSON.parse(bidOrderStruct.output)
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
        if (askOrderStruct.part) {
          this.pushOutputsCellAndData(
            { capacity: bidOrderOutput.capacity, data: bidOrderOutput.data },
            bidOriginalScript,
          )
        }

        if (bidOrderStruct.part) {
          this.pushOutputsCellAndData(
            { capacity: askOrderOutput.capacity, data: askOrderOutput.data },
            bidOriginalScript,
          )
        }

        this.pushDealerMakerCellAndData()
        console.info(this.outputsCells)
        console.info(this.outputsData)

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
      const bidSpendCapacityAmount: bigint = dealPrice * bidSudtOrderAmount
      const bidOriginalCapacityAmount: bigint = BigInt(bidOrderOutput.capacity)

      const askSudtAmount: bigint = parseOrderData(askOrderOutput.data).sudtAmount
      const askCapacityOrderAmount: bigint = parseOrderData(askOrderOutput.data).orderAmount * this.shannonsRatio
      const askSpendSudtAmount: bigint = askCapacityOrderAmount / dealPrice
      const askSudtOrderAmount: bigint = askCapacityOrderAmount / askCapacityPrice
      const askOriginalCapacityAmount: bigint = BigInt(askOrderOutput.capacity)

      this.pushInputCells(askOrderStruct.id, askOrderStruct.part, bidOrderStruct.id, bidOrderStruct.part)

      if (bidSudtOrderAmount == askSudtOrderAmount) {
        const bidDoneCapacityAndSudt: { capacity: string; data: string } = this.calDoneBidCapacityAndSudt({
          bidSpendCapacityAmount: bidSpendCapacityAmount,
          bidSudtOrderAmount: bidSudtOrderAmount,
          bidOriginalCapacityAmount: bidOriginalCapacityAmount,
          bidSudtAmount: bidSudtAmount,
        })
        this.pushOutputsCellAndData(bidDoneCapacityAndSudt, bidOriginalScript)
        bidOrderList.shift()

        const askDoneCapacityAndSudt: { capacity: string; data: string } = this.calDoneAskCapacityAndSudt({
          askSpendSudtAmount: askSpendSudtAmount,
          askCapacityOrderAmount: askCapacityOrderAmount,
          askOriginalCapacityAmount: askOriginalCapacityAmount,
          askSudtAmount: askSudtAmount,
        })
        this.pushOutputsCellAndData(askDoneCapacityAndSudt, askOriginalScript)
        askOrderList.shift()
      } else if (bidSudtOrderAmount < askSudtOrderAmount) {
        // done order
        const bidDoneCkbAndSudt: { capacity: string; data: string } = this.calDoneBidCapacityAndSudt({
          bidSpendCapacityAmount: bidSpendCapacityAmount,
          bidSudtOrderAmount: bidSudtOrderAmount,
          bidOriginalCapacityAmount: bidOriginalCapacityAmount,
          bidSudtAmount: bidSudtAmount,
        })
        this.pushOutputsCellAndData(bidDoneCkbAndSudt, bidOriginalScript)
        bidOrderList.shift()

        const askPartlyCapacityAndSudt: { capacity: string; data: string } = this.calPartlyAskCapacityAndSudt({
          bidSudtOrderAmount: bidSudtOrderAmount,
          bidSpendCapacityAmount: bidSpendCapacityAmount,
          askOriginalCapacityAmount: askOriginalCapacityAmount,
          askCapacityOrderAmount: askCapacityOrderAmount,
          askSudtAmount: askSudtAmount,
          askPrice: askPrice,
        })
        const newAskOutput: OrderDto = this.generateNewOutput(
          askOrderStruct,
          askPartlyCapacityAndSudt,
          askOriginalScript,
        )

        askOrderList.shift()
        askOrderList.unshift(newAskOutput)
      } else {
        const askDoneCkbAndSudt: { capacity: string; data: string } = this.calDoneAskCapacityAndSudt({
          askSpendSudtAmount: askSpendSudtAmount,
          askSudtAmount: askSudtAmount,
          askOriginalCapacityAmount: askOriginalCapacityAmount,
          askCapacityOrderAmount: askCapacityOrderAmount,
        })
        this.pushOutputsCellAndData(askDoneCkbAndSudt, askOriginalScript)
        askOrderList.shift()

        //part dealed order
        const bidPartlyCapacityAndSudt = this.calPartlyBidCapacityAndSudt({
          askCapacityOrderAmount: askCapacityOrderAmount,
          bidOriginalCapacityAmount: bidOriginalCapacityAmount,
          bidSudtOrderAmount: bidSudtOrderAmount,
          askSpendSudtAmount: askSpendSudtAmount,
          bidSudtAmount: bidSudtAmount,
          bidPrice: bidPrice,
        })
        const newBidOutput: OrderDto = this.generateNewOutput(
          bidOrderStruct,
          bidPartlyCapacityAndSudt,
          bidOriginalScript,
        )

        bidOrderList.shift()
        bidOrderList.unshift(newBidOutput)
      }

      if (bidOrderList.length == 0 && askOrderList.length == 0) {
        this.pushDealerMakerCellAndData()

        console.info(this.outputsCells)
        console.info(this.outputsData)

        return this.outputsCells
      }

      if (askOrderList.length == 0 && bidOrderStruct.part) {
        const bidOrderOutput = JSON.parse(bidOrderStruct.output)
        const bidOriginalScript = {
          lock: bidOrderOutput.lock,
          type: bidOrderOutput.type,
        }
        this.pushOutputsCellAndData({ capacity: bidOrderOutput.capacity, data: bidOrderOutput.data }, bidOriginalScript)
        this.pushDealerMakerCellAndData()
        console.info(this.outputsCells)
        console.info(this.outputsData)
        return this.outputsCells
      }

      if (bidOrderList.length == 0 && askOrderStruct.part) {
        const askOrderOutput = JSON.parse(askOrderStruct.output)
        const askOriginalScript = {
          lock: askOrderOutput.lock,
          type: askOrderOutput.type,
        }
        this.pushOutputsCellAndData({ capacity: askOrderOutput.capacity, data: askOrderOutput.data }, askOriginalScript)
        this.pushDealerMakerCellAndData()
        return this.outputsCells
      }

      if (bidOrderList.length == 0 || askOrderList.length == 0) {
        this.pushDealerMakerCellAndData()
        return this.outputsCells
      }

      return this.match(askOrderList, bidOrderList)
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

  private pushInputCells(askId: string, askPart: undefined | boolean, bidId: string, bidPart: undefined | boolean) {
    if (askPart === undefined) {
      const previousInput = {
        previousOutput: {
          txHash: askId.split('-')[0],
          index: askId.split('-')[1],
        },
        since: '0x0',
      }

      this.inputCells.push(previousInput)
      this.witnesses.push('0x')
    }
    if (bidPart === undefined) {
      const previousInput: CKBComponents.CellInput = {
        previousOutput: {
          txHash: bidId.split('-')[0],
          index: bidId.split('-')[1],
        },
        since: '0x0',
      }
      this.inputCells.push(previousInput)
      this.witnesses.push('0x')
    }
  }

  private calDoneBidCapacityAndSudt(args: {
    bidSpendCapacityAmount: bigint
    bidOriginalCapacityAmount: bigint
    bidSudtAmount: bigint
    bidSudtOrderAmount: bigint
  }) {
    const bidMinerFeeCapacityAmount: bigint = (args.bidSpendCapacityAmount * this.fee) / this.feeRatio
    const afterMatchBidCapacity: bigint =
      args.bidOriginalCapacityAmount - args.bidSpendCapacityAmount - bidMinerFeeCapacityAmount
    const afterMatchBidSudtAmount: bigint = args.bidSudtAmount + args.bidSudtOrderAmount
    this.dealMakerCapacityAmount += bidMinerFeeCapacityAmount

    return {
      capacity: '0x' + afterMatchBidCapacity.toString(16),
      data: '0x' + bigIntToUint128Le(afterMatchBidSudtAmount),
    }
  }

  private calDoneAskCapacityAndSudt(args: {
    askSpendSudtAmount: bigint
    askSudtAmount: bigint
    askOriginalCapacityAmount: bigint
    askCapacityOrderAmount: bigint
  }) {
    const askMinerFeeSudtAmount: bigint = (args.askSpendSudtAmount * this.fee) / this.feeRatio
    const afterMatchAskSudtAmount: bigint = args.askSudtAmount - args.askSpendSudtAmount - askMinerFeeSudtAmount
    const afterMatchAskCapacity = args.askOriginalCapacityAmount + args.askCapacityOrderAmount
    this.dealMakerSudtAmount += askMinerFeeSudtAmount

    return {
      capacity: '0x' + afterMatchAskCapacity.toString(16),
      data: '0x' + bigIntToUint128Le(afterMatchAskSudtAmount),
    }
  }

  private transferScriptKey(originalScript: {
    lock: { code_hash: string; hash_type: CKBComponents.ScriptHashType; args: string }
    type: { code_hash: string; hash_type: CKBComponents.ScriptHashType; args: string }
  }) {
    const lockScript = {
      codeHash: originalScript.lock.code_hash,
      hashType: originalScript.lock.hash_type,
      args: originalScript.lock.args,
    }

    const typeScript = {
      codeHash: originalScript.type.code_hash,
      hashType: originalScript.type.hash_type,
      args: originalScript.type.args,
    }

    return { lock: lockScript, type: typeScript }
  }

  private pushOutputsCellAndData(
    capacityAndSudt: { capacity: string; data: string },
    originalScript: {
      lock: { code_hash: string; hash_type: CKBComponents.ScriptHashType; args: string }
      type: { code_hash: string; hash_type: CKBComponents.ScriptHashType; args: string }
    },
  ) {
    const newOutputCell = { ...{ capacity: capacityAndSudt.capacity }, ...this.transferScriptKey(originalScript) }
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
    askSpendSudtAmount: bigint
    bidSudtAmount: bigint
    bidPrice: bigint
  }) {
    const bidMinerFeeCapacityAmount: bigint = (args.askCapacityOrderAmount * this.fee) / this.feeRatio
    const afterPartMatchBidCapacity =
      args.bidOriginalCapacityAmount - args.askCapacityOrderAmount - bidMinerFeeCapacityAmount
    const afterPartMatchBidSudtOrderAmount = args.bidSudtOrderAmount - args.askSpendSudtAmount
    const afterPartMatchBidSudtAmount = args.bidSudtAmount + args.askSpendSudtAmount
    this.dealMakerCapacityAmount += bidMinerFeeCapacityAmount

    return {
      capacity: '0x' + afterPartMatchBidCapacity.toString(16),
      data: `0x${bigIntToUint128Le(afterPartMatchBidSudtAmount)}${bigIntToUint128Le(
        afterPartMatchBidSudtOrderAmount,
      )}${toUint64Le(args.bidPrice).slice(2)}00`,
    }
  }

  private calPartlyAskCapacityAndSudt(args: {
    bidSudtOrderAmount: bigint
    bidSpendCapacityAmount: bigint
    askOriginalCapacityAmount: bigint
    askCapacityOrderAmount: bigint
    askSudtAmount: bigint
    askPrice: bigint
  }) {
    const askMinerFeeSudtAmount: bigint = (args.bidSudtOrderAmount * this.fee) / this.feeRatio
    const afterPartMatchAskOrderCkbAmount =
      (args.askCapacityOrderAmount - args.bidSpendCapacityAmount) / this.shannonsRatio
    const afterPartMatchAskSudtAmount = args.askSudtAmount - args.bidSudtOrderAmount - askMinerFeeSudtAmount
    const afterPartMatchAskCapacityAmount = args.askOriginalCapacityAmount + args.bidSpendCapacityAmount
    this.dealMakerSudtAmount += askMinerFeeSudtAmount

    return {
      capacity: '0x' + afterPartMatchAskCapacityAmount.toString(16),
      data: `0x${bigIntToUint128Le(afterPartMatchAskSudtAmount)}${bigIntToUint128Le(
        afterPartMatchAskOrderCkbAmount,
      )}${toUint64Le(args.askPrice).slice(2)}01`,
    }
  }

  private pushDealerMakerCellAndData() {
    const lockScript: CKBComponents.Script = {
      codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
      hashType: 'type',
      args: this.dealMakerPublicKey,
    }
    const dealMakerCell: CKBComponents.CellOutput = {
      capacity: '0x' + (this.dealMakerCapacityAmount - this.shannonsRatio).toString(16),
      lock: lockScript,
      type: this.outputsCells[0].type,
    }
    this.outputsCells.push(dealMakerCell)
    this.outputsData.push(`0x${bigIntToUint128Le(this.dealMakerSudtAmount)}`)
    return lockScript
  }

  private async generateRawTxAndSend(lockScript: CKBComponents.Script) {
    const rawTransaction: CKBComponents.RawTransaction = {
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
      ],
      inputs: this.inputCells,
      witnesses: this.witnesses,
      outputs: this.outputsCells,
      outputsData: this.outputsData,
    }

    const response = await signAndSendTransaction(rawTransaction, this.privateKey, lockScript, this.indexer)
    console.info(response)
  }
}

export default OrdersService
