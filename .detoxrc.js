/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: { args: { config: 'e2e/jest.config.js' }, jest: { setupTimeout: 180000 } },
  apps: {
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build-detox/Build/Products/Release-iphonesimulator/WorkoutPal.app',
      build: 'bash scripts/build-e2e-ios.sh',
    },
  },
  devices: {
    simulator: { type: 'ios.simulator', device: process.env.DETOX_DEVICE_ID ? { id: process.env.DETOX_DEVICE_ID } : { type: process.env.DETOX_DEVICE_TYPE || 'iPhone 16' } },
  },
  configurations: { 'ios.sim.release': { device: 'simulator', app: 'ios.release' } },
  artifacts: { rootDir: 'artifacts/detox', plugins: { screenshot: { takeWhen: { testFailure: true } }, log: { enabled: true } } },
};
