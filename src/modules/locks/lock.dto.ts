export interface LockDto {
  lockHash: string
  codeHash: string
  hashType: CKBComponents.ScriptHashType
  args: string
}
