import { createConnection, getConnection } from 'typeorm'
import DealRepository from './deal.repository'
import { DealStatus } from './deal.entity'

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

  const DEAL = {
    txHash: 'tx_hash',
    orderIds: 'order_ids',
    fee: 'fee',
    status: DealStatus.Pending,
  }

  it('save deal', async () => {
    let count = await dealRepository.count()
    expect(count).toBe(0)
    await dealRepository.saveDeal(DEAL)
    count = await dealRepository.count()
    expect(count).toBe(1)
  })

  it('remove deal', async () => {
    await dealRepository.saveDeal(DEAL)
    let count = await dealRepository.count()
    expect(count).toBe(1)
    const saved = await dealRepository.findOne()
    await dealRepository.removeDeal(saved.txHash)
    count = await dealRepository.count()
    expect(count).toBe(0)
  })

  it('change deal status', async () => {
    let saved = await dealRepository.saveDeal(DEAL)
    expect(saved.status).toBe(DealStatus.Pending)
    await dealRepository.changeDealStatus(saved.txHash, DealStatus.Done)
    saved = await dealRepository.findOne(saved.txHash)
    expect(saved.status).toBe(DealStatus.Done)
  })

  it('get orders by status', async () => {
    await dealRepository.saveDeal({ ...DEAL, status: DealStatus.Done })

    const doneDeals = await dealRepository.getDealsByStatus(DealStatus.Done, 0)
    const pendingDeals = await dealRepository.getDealsByStatus(DealStatus.Pending, 0)
    expect(doneDeals).toHaveLength(1)
    expect(pendingDeals).toHaveLength(0)
  })

  it('get pending orders', async () => {
    await dealRepository.saveDeal({ ...DEAL, status: DealStatus.Pending })
    const pendingDeals = await dealRepository.getPendingDeals()
    expect(pendingDeals).toHaveLength(1)
  })
})
