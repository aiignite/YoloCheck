import '@testing-library/jest-dom/vitest';
import i18n from '../i18n';

// Ensure tests use Chinese locale
i18n.changeLanguage('zh');

// Mock ResizeObserver for Ant Design components (Tabs, etc.)
const ResizeObserverMock = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverMock });

// Mock window.matchMedia for Ant Design
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock getComputedStyle for jsdom
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
  if (pseudoElt) {
    return {} as CSSStyleDeclaration;
  }
  return originalGetComputedStyle(elt);
};
