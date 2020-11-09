import { Config } from './config.entity'

describe('Test config entity validation', () => {
  it('should throw an error when url is invalid', () => {
    const config = new Config()
    config.remoteUrl = 'hello world'
    expect(() => config.validate()).rejects.toEqual({
      isUrl: 'remote url must be an URL address',
    })
  })
})
