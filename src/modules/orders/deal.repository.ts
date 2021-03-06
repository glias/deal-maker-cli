import { injectable } from 'inversify'
import { EntityRepository, Repository } from 'typeorm'
import { Deal, DealStatus } from './deal.entity'

@injectable()
@EntityRepository(Deal)
class DealRepository extends Repository<Deal> {
  #pageSize = 100
  saveDeal(deal: Omit<Deal, 'createdAt'>) {
    const dealTosave: Deal = this.create(deal)
    return this.save(dealTosave)
  }
  updateDealStatus(txHash: string, status: DealStatus) {
    return this.update(txHash, { status })
  }
  removeDeal(txHash: string) {
    return this.delete(txHash)
  }

  getDeals(pageNo: number, args: string) {
    return this.find({
      skip: pageNo * this.#pageSize,
      take: this.#pageSize,
      order: {
        createdAt: 'DESC',
      },
      where: {
        tokenId: args,
      },
    })
  }

  getDealsByStatus(status: DealStatus, pageNo: number) {
    return this.find({
      skip: pageNo * this.#pageSize,
      take: this.#pageSize,
      order: {
        createdAt: 'DESC',
      },
      where: {
        status,
      },
    })
  }

  getPendingDeals() {
    return this.find({
      where: {
        status: DealStatus.Pending,
      },
    })
  }

  getPendingOrderIds(sudtTypeArgs: string) {
    return this.find({
      where: { status: DealStatus.Pending, tokenId: sudtTypeArgs },
      select: ['orderIds'],
    }).then(orders => orders.flatMap((o: Pick<Deal, 'orderIds'>) => o.orderIds.split(',')))
  }
}

export default DealRepository
