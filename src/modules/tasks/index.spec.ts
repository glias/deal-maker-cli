import 'reflect-metadata'
import TasksService from '.'
// import OrdersService from '../orders'
// import PoolService from '../pool'
import bootstrap from '../../bootstrap'
import { container, modules } from '../../container'

jest.useFakeTimers()

describe('Test tasks module', () => {
  let tasksService: TasksService

  beforeAll(async () => {
    await bootstrap()
  })

  beforeEach(() => {
    tasksService = container.get(modules[TasksService.name])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.skip('start interval in tasksService#work', () => {
    tasksService.work()
    expect(setInterval).toHaveBeenCalled()
  })

  it('tasksService#work should be called in tasksService#start', () => {
    const mockedWork = jest.spyOn(tasksService, 'work')
    tasksService.start()
    expect(setInterval).toHaveBeenCalled()
    expect(mockedWork).toBeCalled()
  })
})
