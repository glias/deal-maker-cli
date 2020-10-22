import { createConnection, getConnection } from 'typeorm'
import DealRepository from './deal.repository'
import { DealStatus } from './deal.entity'
import { pendingDeal, pendingDeal_1, doneDeal } from '../../mock'

describe('Test deal repository', () => {
  let dealRepository: DealRepository
  const CONNECTION_NAME = 'test'

  beforeAll(async () => {
    const connection = await createConnection(CONNECTION_NAME)
    dealRepository = connection.getCustomRepository(DealRepository)
  })

  afterAll(async () => {
    await getConnection(CONNECTION_NAME).close()
  })
  beforeEach(async () => {
    await dealRepository.clear()
  })

  it('save deal', async () => {
    let count = await dealRepository.count()
    expect(count).toBe(0)
    await dealRepository.saveDeal(pendingDeal)
    count = await dealRepository.count()
    expect(count).toBe(1)
  })

  it('remove deal', async () => {
    await dealRepository.saveDeal(pendingDeal)
    let count = await dealRepository.count()
    expect(count).toBe(1)
    const saved = await dealRepository.findOne()
    await dealRepository.removeDeal(saved.txHash)
    count = await dealRepository.count()
    expect(count).toBe(0)
  })

  it('change deal status', async () => {
    let saved = await dealRepository.saveDeal(pendingDeal)
    expect(saved.status).toBe(DealStatus.Pending)
    await dealRepository.changeDealStatus(saved.txHash, DealStatus.Done)
    saved = await dealRepository.findOne(saved.txHash)
    expect(saved.status).toBe(DealStatus.Done)
  })

  it('get orders by status', async () => {
    await dealRepository.saveDeal(doneDeal)

    const doneDeals = await dealRepository.getDealsByStatus(DealStatus.Done, 0)
    const pendingDeals = await dealRepository.getDealsByStatus(DealStatus.Pending, 0)
    expect(doneDeals).toHaveLength(1)
    expect(pendingDeals).toHaveLength(0)
  })

  it('get pending deals', async () => {
    await dealRepository.saveDeal(pendingDeal)
    const pendingDeals = await dealRepository.getPendingDeals()
    expect(pendingDeals).toHaveLength(1)
  })

  it('get pending order ids', async () => {
    await dealRepository.saveDeal(pendingDeal)
    await dealRepository.saveDeal(pendingDeal_1)
    await dealRepository.saveDeal(doneDeal)
    const pendingOrderIds = await dealRepository.getPendingOrderIds()
    expect(pendingOrderIds).toEqual([...pendingDeal.orderIds.split(','), ...pendingDeal_1.orderIds.split(',')])
  })
})
