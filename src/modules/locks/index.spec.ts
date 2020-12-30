import { Connection, createConnection, Repository } from 'typeorm'
import LockService from '.'
import LocksService from '.'
import { LockDto } from './lock.dto'
import { Lock } from './lock.entity'

describe('Test locks module', () => {
  let locksService: LocksService
  let lockRepository: Repository<Lock>
  let connection: Connection

  const LOCKS: Record<string, LockDto> = {
    lock_1: {
      lockHash: 'lock_hash_1',
      codeHash: 'code_hash_1',
      hashType: 'data',
      args: 'args_1',
    },
    lock_2: {
      lockHash: 'lock_hash_2',
      codeHash: 'code_hash_2',
      hashType: 'data',
      args: 'args_2',
    },
  }

  beforeEach(async () => {
    connection = await createConnection('test')
    lockRepository = connection.getRepository(Lock)
    locksService = new LocksService()
  })

  afterEach(async () => {
    await connection.close()
  })

  describe('set and get block number', () => {
    it('return 0 if block number is not set', async () => {
      const blockNumber = await locksService.getBlockNumber()
      expect(blockNumber).toBe('0')
    })

    it('return updated block number', async () => {
      const BLOCK_NUMBER = '0x123'
      await locksService.setBlockNumber(BLOCK_NUMBER)
      const blockNumber = await locksService.getBlockNumber()
      expect(blockNumber).toBe(BLOCK_NUMBER)
    })
  })

  describe('add one lock', () => {
    it('add one if not exist', async () => {
      let count = await lockRepository.count()
      expect(count).toBe(0)
      await locksService.addLock(LOCKS.lock_1)
      count = await lockRepository.count()
      expect(count).toBe(1)
    })

    it('skip if exist', async () => {
      await locksService.addLock(LOCKS.lock_1)
      let count = await lockRepository.count()
      expect(count).toBe(1)
      await locksService.addLock(LOCKS.lock_1)
      count = await lockRepository.count()
      expect(count).toBe(1)
    })
  })

  it('add lock list', async () => {
    let count = await lockRepository.count()
    expect(count).toBe(0)
    await locksService.addLockList(
      new Map([
        [LOCKS.lock_1.lockHash, LOCKS.lock_1],
        [LOCKS.lock_2.lockHash, LOCKS.lock_2],
      ]),
    )
    count = await lockRepository.count()
    expect(count).toBe(2)
  })

  it('find locks by lock hashes', async () => {
    await locksService.addLockList(
      new Map([
        [LOCKS.lock_1.lockHash, LOCKS.lock_1],
        [LOCKS.lock_2.lockHash, LOCKS.lock_2],
      ]),
    )

    const lockHashList = [LOCKS.lock_2.lockHash, 'lock_hash_not_saved']

    const found = await locksService.findByLockHashList(lockHashList)
    expect(found).toHaveLength(1)
    expect(found[0].lockHash).toBe(lockHashList[0])
  })
})
