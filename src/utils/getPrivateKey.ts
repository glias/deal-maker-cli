import fs from 'fs'

export const getPrivateKey = (keyFilePath: string) => {
  if (!keyFilePath) return process.env.PRIVATE_KEY || null

  try {
    return fs.readFileSync(keyFilePath, 'utf-8').trim()
  } catch (err) {
    return null
  }
}
