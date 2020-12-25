import { isCellValid } from './validator'
import fixtures from './validator.fixture.json'

describe('Test validator', () => {
  describe('Test isCellValid', () => {
    const fixtureTable = Object.entries(fixtures.isCellValid).map(([title, { cell, expected }]) => [
      title,
      cell,
      expected,
    ])

    it.each(fixtureTable)('%s', (_title, cell: any, expected) => {
      expect(isCellValid(cell)).toBe(expected)
    })
  })
})
