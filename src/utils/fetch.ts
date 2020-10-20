import fetch from 'node-fetch'
import { mockLock } from './scripts'

type Script = {
  args: string
  code_hash: string
  hash_type: 'data' | 'type'
}

interface Cell {
  block_number: string
  out_point: Record<'index' | 'tx_hash', string>
  output: {
    capacity: string
    lock: Script
    type: Script | null
  }
  output_data: string
  tx_index: string
}
export const fastSync = async (apiUrl: string, save: Function, cursor?: string): Promise<boolean> => {
  const res: {
    objects: Array<Cell>
    last_cursor: string
  } = await fetch(apiUrl, {
    method: 'post',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'get_cells',
      params: [{ script: mockLock.script, script_type: mockLock.script_type }, 'desc', '0x64', cursor || null],
    }),
  })
    .then(r => r.json())
    .then(r => {
      if (!r.result) {
        throw new Error(r.error)
      }
      return r.result
    })
  save(res.objects)
  if (res.last_cursor !== '0x') {
    return fastSync(apiUrl, save, res.last_cursor)
  }
  return true
}

export const getTipBlockNumber = (apiUrl: string) =>
  fetch(apiUrl, {
    method: 'post',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'get_tip_block_number',
      params: [],
    }),
  })
    .then(res => res.json())
    .then(res => {
      if (res.result) {
        return res.result
      }
      throw new Error(res.error)
    })
