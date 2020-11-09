import { Config } from './config.entity'

describe('Test config entity validation', () => {
  it('should throw an error when url is invalid', () => {
    const config = new Config()
    config.remoteUrl = 'hello world'
    expect(() => config.validate()).rejects.toEqual(
      new Error(JSON.stringify({ isUrl: 'remote url must be an URL address' })),
    )
  })
})
