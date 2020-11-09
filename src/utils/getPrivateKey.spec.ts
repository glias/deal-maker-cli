const mockReadFileSync = jest.fn()
jest.doMock('fs', () => ({
  readFileSync: mockReadFileSync,
}))

import { getPrivateKey } from './getPrivateKey'

describe('Test getPrivateKey', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })
  it('should return null if key file path is empty', () => {
    expect(getPrivateKey('')).toBeNull()
  })

  it('should return null when key file is invalid', () => {
    mockReadFileSync.mockReturnValue(1)
    expect(getPrivateKey('mock_key_file_path')).toBeNull()
  })

  it('should trim content', () => {
    mockReadFileSync.mockReturnValue(' value ')
    expect(getPrivateKey('mock_key_file_path')).toBe('value')
  })
})
