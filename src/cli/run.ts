import DealMaker from '..'

const run = () => {
  const dealMaker = new DealMaker()
  dealMaker.run()
}

export default {
  cmd: 'run',
  desc: 'start deal maker',
  exec: run,
}
