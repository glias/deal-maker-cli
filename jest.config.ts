import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  verbose: false,
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
}

export default config
