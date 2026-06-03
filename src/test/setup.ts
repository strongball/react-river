import '@testing-library/jest-dom';

const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].startsWith('[react-river]')) {
    return;
  }
  originalConsoleError(...args);
};
