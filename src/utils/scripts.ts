interface Lock {
  script: {
    code_hash: string
    hash_type: 'data' | 'type'
    args: string
  }
  script_type: 'lock' | 'type'
}
export const mockLock: Lock = {
  script: {
    code_hash: '0x48dbf59b4c7ee1547238021b4869bceedf4eea6b43772e5d66ef8865b6ae7212',
    hash_type: 'data',
    args: '0x94bbc8327e16d195de87815c391e7b9131e80419c51a405a0b21227c6ee05129',
  },
  script_type: 'type',
}
