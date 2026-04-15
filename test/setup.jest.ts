// Mock ant-plus before any modules load it
jest.mock('ant-plus', () => ({}), { virtual: true });
jest.mock('usb', () => ({}), { virtual: true });
