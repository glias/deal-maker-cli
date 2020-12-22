import { injectable } from 'inversify'
import { getConnection } from 'typeorm'
import { LockDto } from './lock.dto'
import { Lock } from './lock.entity'
import { LockSyncMeta } from './meta.entity'

@injectable()
class LockService {
  #lockRepository = getConnection(process.env.NODE_ENV).getRepository(Lock)
  #metaRepository = getConnection(process.env.NODE_ENV).getRepository(LockSyncMeta)

  getBlockNumber = () => {
    return this.#metaRepository.findOne().then(res => res?.blockNumber || '0')
  }

  setBlockNumber = async (blockNumber: string) => {
    let meta = await this.#metaRepository.findOne()
    if (!meta) {
      meta = this.#metaRepository.create()
    }
    meta.blockNumber = blockNumber
    return this.#metaRepository.save(meta)
  }

  getAllLocks = () => {
    return this.#lockRepository.find()
  }

  findByLockHash = (lockHash: string) => {
    return this.#lockRepository.findOne(lockHash)
  }

  addLock = async (lock: LockDto) => {
    const found = await this.#lockRepository.findOne(lock)
    if (found) {
      return
    }
    await this.#lockRepository.save(lock)
  }

  addLockList = async (lockList: Map<string, CKBComponents.Script>) => {
    return this.#metaRepository.manager.transaction(async txManager => {
      for (const [lockHash, script] of lockList) {
        const found = await this.#lockRepository.findOne(lockHash)
        if (!found) {
          const lock = txManager.create(Lock, { ...script, lockHash })
          await txManager.save(lock)
        }
      }
    })
  }
}

export default LockService
