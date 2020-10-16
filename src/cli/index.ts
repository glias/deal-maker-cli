#!/usr/bin/env node

import { Command } from 'commander'
import setVersion from './setVersion'
import init from './init'
import run from './run'
import config from './config'

const start = () => {
  const program = new Command()
  setVersion(program)

  /* set options */

  /* set commands */
  const commandList: Array<{
    cmd: string
    desc: string
    options?: Record<string, Record<'option' | 'desc', string>>
    exec: (...args: any[]) => void | Promise<void>
  }> = [init, run, config]
  commandList.forEach(meta => {
    const subCmd = program.command(meta.cmd)
    if (meta.options) {
      Object.values(meta.options).forEach(meta => {
        subCmd.option(meta.option).description(meta.desc)
      })
    }
    subCmd.description(meta.desc).action(meta.exec)
  })

  program.parse(process.argv)
}

start()
