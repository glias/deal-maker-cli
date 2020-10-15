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
  // program.option(init.cmd, init.desc).option(run.cmd, run.desc)

  /* set commands */
  const commandList = [init, run, config]
  commandList.forEach(meta => {
    program.command(meta.cmd).description(meta.desc).action(meta.exec)
  })
  program.parse(process.argv)
}

start()
