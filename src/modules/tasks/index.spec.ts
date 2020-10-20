jest.mock('node-fetch', () => require('fetch-mock').sandbox())
const fetchMock = require('node-fetch')

fetchMock.config.overwriteRoutes = false

import 'reflect-metadata'
import { injectable } from 'inversify'
import TasksService from '.'
import ConfigService from '../config'
import OrdersService from '../orders'
import { container, modules } from '../../container'

@injectable()
class MockConfigService {
  setTipBlockNumber = jest.fn()
}

@injectable()
class MockOrdersService {}

jest.useFakeTimers()

describe('Test tasks module', () => {
  let tasksService: TasksService

  beforeAll(async () => {
    modules[ConfigService.name] = Symbol(ConfigService.name)
    modules[OrdersService.name] = Symbol(OrdersService.name)
    modules[TasksService.name] = Symbol(TasksService.name)
    container.bind(modules[ConfigService.name]).to(MockConfigService)
    container.bind(modules[OrdersService.name]).to(MockOrdersService)
    container.bind(modules[TasksService.name]).to(TasksService)

    tasksService = container.get(modules[TasksService.name])
  })

  describe('Test sync', () => {
    const fixtures = {
      tipBlockNumber: '0x1234',
      remoteUrl: 'http://localhost:8114',
    }

    describe('Test fast sync', () => {
      beforeAll(() => {
        fetchMock.post(`${fixtures.remoteUrl}/rpc`, { result: fixtures.tipBlockNumber })
      })
      it('should update tip block number', async () => {
        await tasksService.fastSync(fixtures.remoteUrl)
        const configService = container.get<any>(modules[ConfigService.name])
        expect(configService.setTipBlockNumber.mock.calls[0][0]).toEqual(fixtures.tipBlockNumber)
      })
    })
  })
})
