import { injectable, inject, LazyServiceIdentifer } from 'inversify'
import { privateKeyToPublicKey, blake160, rawTransactionToHash } from '@nervosnetwork/ckb-sdk-utils'
import loadCells from '@nervosnetwork/ckb-sdk-core/lib/loadCellsFromIndexer'
import { Indexer, CellCollector } from '@ckb-lumos/indexer'
import { CronJob } from 'cron'
import { modules } from '../../container'
import OrdersService from '../orders'
import ConfigService from '../config'
import {
  logger,
  startIndexer,
  scanOrderCells,
  subscribeOrderCell,
  checkPendingDeals,
  signAndSendTransaction,
  getPrivateKey,
  SUDT_TYPE_ARGS_LIST,
  SECP256K1_CODE_HASH,
} from '../../utils'
import { Deal, DealStatus } from '../orders/deal.entity'
import Matcher from './matcher'

const logTag = `\x1b[35m[Tasks Service]\x1b[0m`

@injectable()
class TasksService {
  readonly #ordersService: OrdersService
  readonly #configService: ConfigService
  #indexer!: Indexer
  readonly #schedule = {
    match: '*/5 * * * * *',
    checkPending: '*/10 * * * * *',
  }
  #info = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }
  #warn = (msg: string) => {
    logger.warn(`${logTag}: ${msg}`)
  }

  constructor(
    @inject(new LazyServiceIdentifer(() => modules[OrdersService.name])) ordersService: OrdersService,
    @inject(new LazyServiceIdentifer(() => modules[ConfigService.name])) configService: ConfigService,
  ) {
    this.#ordersService = ordersService
    this.#configService = configService
  }

  start = async () => {
    await this.startIndexer()
    await this.scanOrderCells()
    this.subscribeOrderCell()
    new CronJob(this.#schedule.match, this.matchOrders, null, true)
    new CronJob(this.#schedule.checkPending, this.checkPendingDeals, null, true)
  }

  readonly startIndexer = async () => {
    const nodeUrl = await this.#configService.getConfig().then(config => config.remoteUrl)
    const indexerDbPath = this.#configService.getDbPath().indexer
    this.#indexer = await startIndexer(nodeUrl, indexerDbPath)
  }

  readonly scanOrderCells = async () => {
    return scanOrderCells(this.#indexer, this.#ordersService.flushOrders)
  }

  readonly subscribeOrderCell = async () => {
    this.#info(`Subscribe to order cell`)
    return subscribeOrderCell(this.#indexer, this.scanOrderCells)
  }

  readonly checkPendingDeals = async () => {
    const pendingDeals = await this.#ordersService.getPendingDeals()
    if (!pendingDeals.length) return

    const nodeUrl = await this.#configService.getConfig().then(config => config.remoteUrl)
    const checkResults = await checkPendingDeals(
      nodeUrl,
      pendingDeals.map(d => d.txHash),
    )

    const now = Date.now()
    const TIMEOUT = 60 * 10 * 1000 // 10 minutes

    for (let i = 0; i < pendingDeals.length; i++) {
      const deal = pendingDeals[i]
      if (checkResults[i]) {
        await this.#ordersService.updateDealStatus(deal.txHash, DealStatus.Done)
      } else if (now - deal.createdAt.getTime() >= TIMEOUT) {
        await this.#ordersService.updateDealStatus(deal.txHash, DealStatus.TIMEOUT)
      }
    }
  }

  readonly getSyncState = async () => {
    const tip = await this.#indexer.tip().then(tip => +tip.block_number)
    return { tip }
  }

  readonly matchOrders = async () => {
    const config = await this.#configService.getConfig()
    const privateKey = getPrivateKey(config.keyFile ?? '')
    if (!privateKey) {
      this.#warn('No private key found')
      return false
    }
    return Promise.all(
      SUDT_TYPE_ARGS_LIST.map(async tokenId => {
        const [bidOrderList, askOrderList, pendingDeals] = await Promise.all([
          this.#ordersService.getBidOrders(tokenId),
          this.#ordersService.getAskOrders(tokenId),
          this.#ordersService.getPendingDeals(),
        ])

        if (!askOrderList.length || !bidOrderList.length) {
          return false
        }

        const publicKeyHash = `0x${blake160(privateKeyToPublicKey(privateKey), 'hex')}`
        const dealMakerLock: CKBComponents.Script = {
          codeHash: SECP256K1_CODE_HASH,
          hashType: 'type',
          args: publicKeyHash,
        }

        const liveCells = await loadCells({ indexer: this.#indexer, CellCollector, lock: dealMakerLock })
        const pendingDealMakerCellOutPoints = pendingDeals.map(deal => deal.dealMakerCell)
        const dealMakerCells = liveCells.filter(
          cell =>
            !pendingDealMakerCellOutPoints.includes(`${cell.outPoint.txHash}:${cell.outPoint.index}`) &&
            (cell.type?.args === tokenId || !cell.type),
        )
        if (!dealMakerCells.length) {
          this.#info(`No normal cells or ${tokenId} live cells`)
          return false
        }

        const dealMakerCell =
          dealMakerCells.find(c => c.type) ||
          dealMakerCells.sort((c1, c2) => Number(BigInt(c2.capacity) - BigInt(c1.capacity)))[0]

        const matcher = new Matcher(bidOrderList, askOrderList, dealMakerCell)

        matcher.match()
        if (!matcher.rawTx) {
          return false
        }

        const orderIds = matcher.rawTx.inputs
          .slice(1)
          .map(i => `${i.previousOutput?.txHash}-${i.previousOutput?.index}`)
          .join()

        const rawTx = matcher.rawTx
        const txHash = rawTransactionToHash(rawTx)
        const dealRecord: Omit<Deal, 'createdAt'> = {
          txHash,
          tokenId,
          orderIds,
          fee: `${matcher.minerFee}`,
          dealMakerCell: `${matcher.dealMakerCell.outPoint.txHash}:${matcher.dealMakerCell.outPoint.index}`,
          ckbProfit: `${matcher.dealMakerCapacityAmount}`,
          sudtProfit: `${matcher.dealMakerSudtAmount}`,
          status: DealStatus.Pending,
        }

        try {
          const response = await signAndSendTransaction(rawTx, privateKey)
          dealRecord.txHash = response
        } catch (error) {
          this.#warn(error)
          dealRecord.status = DealStatus.Failed
        }

        this.#ordersService.saveDeal(dealRecord)
        return true
      }),
    )
  }
}

export default TasksService
