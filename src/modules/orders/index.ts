import { injectable } from 'inversify'
import { getConnection } from 'typeorm'
import type { Cell } from '@ckb-lumos/base'
import { toUint64Le } from '@nervosnetwork/ckb-sdk-utils/lib/convertors'
import OrderRepository from './order.repository'
import { OrderType } from './order.entity'
import { OrderDto } from './order.dto'
import DealRepository from './deal.repository'
import { logger, parseOrderCell, parseOrderData, bigIntToUint128Le } from '../../utils'
import { Deal, DealStatus } from './deal.entity'

const logTag = `\x1b[35m[Orders Service]\x1b[0m`

//TODO combine transaction

namespace Cell {
  export interface Struct {
    capacity: string
    lockScript: object
    typeScript: object
  }
}

namespace Order {
  export interface Struct {
    id: string
    tokenId: string
    blockNumber: number
    type: string
    price: bigint
    output: string
    part?: boolean
  }
}

@injectable()
class OrdersService {
  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }

  #orderRepository = getConnection(process.env.NODE_ENV).getCustomRepository(OrderRepository)
  #dealRepository = getConnection(process.env.NODE_ENV).getCustomRepository(DealRepository)

  inputCells: Array<object> = []
  outputsCells: Array<object> = []
  outputsData: Array<string> = []
  dealMakerCkbAmount: bigint = BigInt('0')
  dealMakerSudtAmount: bigint = BigInt('0')
  fee: bigint = BigInt('0.002')

  // before match
  // 1. length 有一个为0

  // if (askOrderList.length == 0 || bidOrderList.length == 0) {
  //   return
  // }
  public match(
    askOrderList: Array<[bigint, number, Order.Struct]>,
    bidOrderList: Array<[bigint, number, Order.Struct]>,
  ): any {
    // after match
    // 1. match all, length both 0
    // 2. ask order length 0, bidOrderList part push current cell
    // 3. ask order length 0, bidOrderList not part
    // 4. bid order length 0, askOrderList part push current cell
    // 5. bid order length 0, askOrderList not part
    // 6. ask length and bid length both not 0
    if (askOrderList.length == 0 && bidOrderList[0][2].part) {
      const bidOrderOutput = JSON.parse(bidOrderList[0][2].output)
      const bidOriginalScript = {
        lock: bidOrderOutput.lock,
        type: bidOrderOutput.type,
      }
      this.pushOutputsCellAndData(
        { capacity: bidOrderOutput.cell_output.capacity, data: bidOrderOutput.data },
        bidOriginalScript,
      )
      this.pushDealerMakerCellAndData()
      return this.outputsCells
      // sign_and_send()
    }
    if (bidOrderList.length == 0 && askOrderList[0][2].part) {
      const askOrderOutput = JSON.parse(askOrderList[0][2].output)
      const askOriginalScript = {
        lock: askOrderOutput.lock,
        type: askOrderOutput.type,
      }
      this.pushOutputsCellAndData({ capacity: askOrderOutput.capacity, data: askOrderOutput.data }, askOriginalScript)
      this.pushDealerMakerCellAndData()
      return this.outputsCells
      // sign_and_send()
    }

    if (bidOrderList.length == 0 || askOrderList.length == 0) {
      this.pushDealerMakerCellAndData()
      return this.outputsCells
    }

    const askMatchOrder = askOrderList[0]
    const bidMatchOrder = bidOrderList[0]
    const [askPrice, askOrderBlockNum, askOrderStruct] = askMatchOrder
    const [bidPrice, bidOrderBlockNum, bidOrderStruct] = bidMatchOrder
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
        if (askOrderList[0][2].part) {
          this.pushOutputsCellAndData(
            { capacity: bidOrderOutput.capacity, data: bidOrderOutput.data },
            bidOriginalScript,
          )
        }

        if (bidOrderList[0][2].part) {
          this.pushOutputsCellAndData(
            { capacity: askOrderOutput.capacity, data: askOrderOutput.data },
            bidOriginalScript,
          )
        }

        this.pushDealerMakerCellAndData()
        return this.outputsCells
        // sign_and_send()
      } else {
        return 'No Match Order'
      }
    } else {
      const dealPrice: bigint = this.calDealPrice(askOrderBlockNum, bidOrderBlockNum, askPrice, bidPrice)

      const bidSudtAmount: bigint = parseOrderData(bidOrderOutput.data).sudtAmount
      const bidSudtOrderAmount: bigint = parseOrderData(bidOrderOutput.data).orderAmount
      const bidSpendCkbAmount: bigint = dealPrice * bidSudtOrderAmount
      const bidOriginalCkbAmount: bigint = BigInt(bidOrderOutput.capacity) / BigInt('1000000000')

      const askSudtAmount: bigint = parseOrderData(askOrderOutput.data).sudtAmount
      const askCkbOrderAmount: bigint = parseOrderData(askOrderOutput.data).orderAmount
      const askSpendSudtAmount: bigint = askCkbOrderAmount / dealPrice
      const askSudtOrderAmount: bigint = askCkbOrderAmount / askPrice
      const askOriginalCkbAmount: bigint = BigInt(askOrderOutput.capacity) / BigInt('1000000000')

      this.pushInputCells(askOrderStruct.id, askOrderStruct.part, bidOrderStruct.id, bidOrderStruct.part)

      if (bidSudtOrderAmount == askSudtOrderAmount) {
        const bidDoneCapacityAndSudt: { capacity: string; data: string } = this.calDoneBidCapacityAndSudt({
          bidSpendCkbAmount: bidSpendCkbAmount,
          bidSudtOrderAmount: bidSudtOrderAmount,
          bidOriginalCkbAmount: bidOriginalCkbAmount,
          bidSudtAmount: bidSudtAmount,
        })
        this.pushOutputsCellAndData(bidDoneCapacityAndSudt, bidOriginalScript)
        bidOrderList.shift()

        const askDoneCapacityAndSudt: { capacity: string; data: string } = this.calDoneAskCapacityAndSudt({
          askSpendSudtAmount: askSpendSudtAmount,
          askCkbOrderAmount: askCkbOrderAmount,
          askOriginalCkbAmount: askOriginalCkbAmount,
          askSudtAmount: askSudtAmount,
        })
        this.pushOutputsCellAndData(askDoneCapacityAndSudt, askOriginalScript)
        askOrderList.shift()
      } else if (bidSudtOrderAmount < askSudtOrderAmount) {
        // done order
        const bidDoneCkbAndSudt: { capacity: string; data: string } = this.calDoneBidCapacityAndSudt({
          bidSpendCkbAmount: bidSpendCkbAmount,
          bidSudtOrderAmount: bidSudtOrderAmount,
          bidOriginalCkbAmount: bidOriginalCkbAmount,
          bidSudtAmount: bidSudtAmount,
        })
        this.pushOutputsCellAndData(bidDoneCkbAndSudt, bidOriginalScript)
        bidOrderList.shift()

        const askPartlyCapacityAndSudt: { capacity: string; data: string } = this.calPartlyAskCapacityAndSudt({
          bidSudtOrderAmount: bidSudtOrderAmount,
          bidSpendCkbAmount: bidSpendCkbAmount,
          askOriginalCkbAmount: askOriginalCkbAmount,
          askCkbOrderAmount: askCkbOrderAmount,
          askSudtAmount: askSudtAmount,
          askPrice: askPrice,
        })
        const newAskOutput: Order.Struct = this.generateNewOutput(
          askOrderStruct,
          askPartlyCapacityAndSudt,
          askOriginalScript,
        )

        askOrderList.shift()
        askOrderList.unshift([askPrice, askOrderBlockNum, newAskOutput])
      } else {
        const askDoneCkbAndSudt: { capacity: string; data: string } = this.calDoneAskCapacityAndSudt({
          askSpendSudtAmount: askSpendSudtAmount,
          askSudtAmount: askSudtAmount,
          askOriginalCkbAmount: askOriginalCkbAmount,
          askCkbOrderAmount: askCkbOrderAmount,
        })
        this.pushOutputsCellAndData(askDoneCkbAndSudt, askOriginalScript)
        askOrderList.shift()

        //part dealed order
        const bidPartlyCapacityAndSudt = this.calPartlyBidCapacityAndSudt({
          askCkbOrderAmount: askCkbOrderAmount,
          bidOriginalCkbAmount: bidOriginalCkbAmount,
          bidSudtOrderAmount: bidSudtOrderAmount,
          askSpendSudtAmount: askSpendSudtAmount,
          bidSudtAmount: bidSudtAmount,
          bidPrice: bidPrice,
        })
        const newBidOutput: Order.Struct = this.generateNewOutput(
          bidOrderStruct,
          bidPartlyCapacityAndSudt,
          bidOriginalScript,
        )

        bidOrderList.shift()
        bidOrderList.unshift([bidPrice, bidOrderBlockNum, newBidOutput])
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

  public getPendingDeals = () => {
    return this.#dealRepository.getPendingDeals()
  }

  private calDealPrice(askOrderBlockNum: number, bidOrderBlockNum: number, askPrice: bigint, bidPrice: bigint): bigint {
    if (askOrderBlockNum == bidOrderBlockNum) {
      return (bidPrice + askPrice) / BigInt('2')
    } else {
      return askOrderBlockNum > bidOrderBlockNum ? bidPrice : askPrice
    }
  }

  private pushInputCells(askId: string, askPart: undefined | boolean, bidId: string, bidPart: undefined | boolean) {
    if (askPart === undefined) {
      const previousInput = {
        previousOutput: {
          txHash: askId.split('-')[0],
          index: askId.split('-')[1],
        },
      }

      this.inputCells.push(previousInput)
    }
    if (bidPart === undefined) {
      const previousInput = {
        previousOutput: {
          txHash: bidId.split('-')[0],
          index: bidId.split('-')[1],
        },
      }
      this.inputCells.push(previousInput)
    }
  }

  private calDoneBidCapacityAndSudt(args: {
    bidSpendCkbAmount: bigint
    bidOriginalCkbAmount: bigint
    bidSudtAmount: bigint
    bidSudtOrderAmount: bigint
  }) {
    const bidMinerFeeCkbAmount: bigint = args.bidSpendCkbAmount * this.fee
    const afterMatchBidCkb: bigint = args.bidOriginalCkbAmount - args.bidSpendCkbAmount - bidMinerFeeCkbAmount
    const afterMatchBidSudtAmount: bigint = args.bidSudtAmount + args.bidSudtOrderAmount
    this.dealMakerCkbAmount += bidMinerFeeCkbAmount

    return {
      capacity: '0x' + (afterMatchBidCkb * BigInt('10000000')).toString(16),
      data: '0x' + bigIntToUint128Le(afterMatchBidSudtAmount),
    }
  }

  private calDoneAskCapacityAndSudt(args: {
    askSpendSudtAmount: bigint
    askSudtAmount: bigint
    askOriginalCkbAmount: bigint
    askCkbOrderAmount: bigint
  }) {
    const askMinerFeeSudtAmount: bigint = args.askSpendSudtAmount * this.fee
    const afterMatchAskSudtAmount: bigint = args.askSudtAmount - args.askSpendSudtAmount - askMinerFeeSudtAmount
    const afterMatchAskCkb = args.askOriginalCkbAmount + args.askCkbOrderAmount
    this.dealMakerSudtAmount += askMinerFeeSudtAmount

    return {
      capacity: '0x' + (afterMatchAskCkb * BigInt('10000000')).toString(16),
      data: '0x' + bigIntToUint128Le(afterMatchAskSudtAmount),
    }
  }

  private pushOutputsCellAndData(capacityAndSudt: { capacity: string; data: string }, originalScript: object) {
    const newOutputCell = Object.assign({}, { capacity: capacityAndSudt.capacity }, originalScript)
    this.outputsCells.push(newOutputCell)
    this.outputsData.push(capacityAndSudt.data)
  }

  private generateNewOutput(
    originalOrderCell: Order.Struct,
    capacityAndSudt: { capacity: string; data: string },
    originalScript: { lock: object; type: object },
  ) {
    const newOutputCell: { capacity: string; lock: object; type: object } = {
      ...{ capacity: capacityAndSudt.capacity },
      ...originalScript,
    }
    return { ...originalOrderCell, ...{ cell_output: newOutputCell, data: capacityAndSudt.data }, ...{ part: true } }
  }

  private calPartlyBidCapacityAndSudt(args: {
    askCkbOrderAmount: bigint
    bidOriginalCkbAmount: bigint
    bidSudtOrderAmount: bigint
    askSpendSudtAmount: bigint
    bidSudtAmount: bigint
    bidPrice: bigint
  }) {
    const bidMinerFeeCkbAmount: bigint = args.askCkbOrderAmount * this.fee
    const afterPartMatchBidCkb = args.bidOriginalCkbAmount - args.askCkbOrderAmount - bidMinerFeeCkbAmount
    const afterPartMatchBidSudtOrderAmount = args.bidSudtOrderAmount - args.askSpendSudtAmount
    const afterPartMatchBidSudtAmount = args.bidSudtAmount + args.askSpendSudtAmount
    this.dealMakerCkbAmount += bidMinerFeeCkbAmount

    return {
      capacity: '0x' + afterPartMatchBidCkb.toString(16),
      data: `0x${bigIntToUint128Le(afterPartMatchBidSudtAmount)}${bigIntToUint128Le(
        afterPartMatchBidSudtOrderAmount,
      )}${toUint64Le(args.bidPrice)}00`,
    }
  }

  private calPartlyAskCapacityAndSudt(args: {
    bidSudtOrderAmount: bigint
    bidSpendCkbAmount: bigint
    askOriginalCkbAmount: bigint
    askCkbOrderAmount: bigint
    askSudtAmount: bigint
    askPrice: bigint
  }) {
    const askMinerFeeSudtAmount: bigint = args.bidSudtOrderAmount * this.fee
    const afterPartMatchAskOrderCkbAmount = args.askCkbOrderAmount - args.bidSpendCkbAmount
    const afterPartMatchAskSudtAmount = args.askSudtAmount - args.bidSudtOrderAmount - askMinerFeeSudtAmount
    const afterPartMatchAskCkbAmount = args.askOriginalCkbAmount + args.bidSpendCkbAmount
    this.dealMakerSudtAmount += askMinerFeeSudtAmount

    return {
      capacity: '0x' + afterPartMatchAskCkbAmount.toString(16),
      data: `0x${bigIntToUint128Le(afterPartMatchAskSudtAmount)}${bigIntToUint128Le(
        afterPartMatchAskOrderCkbAmount,
      )}${toUint64Le(args.askPrice)}01`,
    }
  }

  private pushDealerMakerCellAndData() {
    const dealMakerCell: Cell.Struct = {
      capacity: '0x' + (this.dealMakerCkbAmount * BigInt('100000000')).toString(16),
      lockScript: {},
      typeScript: {},
    }
    this.outputsCells.push(dealMakerCell)
    this.outputsData.push(this.dealMakerSudtAmount.toString(16))
  }
}

export default OrdersService
