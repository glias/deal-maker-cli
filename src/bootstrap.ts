import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { createConnection } from 'typeorm'
import { container, modules } from './container'
import { logger } from './utils'

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production'
}

const logTag = `\x1b[35m[Bootstrap]\x1b[0m`

const registerModule = async (modulePath: string) => {
  const { default: m } = await import(modulePath)
  modules[m.name] = Symbol(m.name)
  container.bind(modules[m.name]).to(m)
  logger.debug(`${logTag}: \x1b[36m${m.name}\x1b[0m is loaded`)
}

const connectDatabase = async () => {
  if (!process.env.NODE_ENV) {
    throw new Error(`Expect NODE_ENV to be development, test or production`)
  }

  const connection = await createConnection(process.env.NODE_ENV)
  logger.debug(`${logTag}: Connected to database \x1b[36m${connection.name}\x1b[0m`)
  return connection
}

const bootstrap = async () => {
  const modulesDir = path.join(__dirname, 'modules')
  const modulePaths = await promisify(fs.readdir)(modulesDir, 'utf8').then(moduleNames =>
    moduleNames.map(moduleName => path.join(modulesDir, moduleName)),
  )
  for (const modulePath of modulePaths) {
    await registerModule(modulePath)
  }

  await connectDatabase()
}

export default bootstrap
