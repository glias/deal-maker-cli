import DealMaker from '..'

const reset = () => {
  const dealMaker = new DealMaker()
  dealMaker.reset()
}

export default {
  cmd: 'reset',
  desc: 'reset orders data',
  exec: reset,
}
