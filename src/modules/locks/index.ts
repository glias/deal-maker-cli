import axios, { AxiosResponse } from 'axios'
import { injectable } from 'inversify'
import { getConnection, In } from 'typeorm'
import { SERVER_URL } from '../../utils'
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

  findByLockHashList = (lockHashList: Array<string>) => {
    return this.#lockRepository.find({ lockHash: In(lockHashList) })
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

  fetchLockList = async (lockHashList: Array<string>) => {
    if (!SERVER_URL || !lockHashList.length) {
      return
    }

    try {
      const res = await axios.post<
        any,
        AxiosResponse<Array<{ lock_hash: string; script: Record<'code_hash' | 'hash_type' | 'args', string> }>>
      >(`${SERVER_URL}/scripts/lock-scripts`, {
        lock_hashes: [...new Set(lockHashList)],
      })

      if (!Array.isArray(res.data)) {
        throw new Error('Invalid response from server')
      }

      res.data.forEach(lock => {
        this.addLock({
          lockHash: lock.lock_hash,
          codeHash: lock.script.code_hash,
          hashType: lock.script.hash_type as CKBComponents.ScriptHashType,
          args: lock.script.args,
        })
      })
    } catch {
      // ignore
    }
  }
}

export default LockService
