// jsdom does not implement matchMedia. Every real target (including every
// iPhone Safari version this app cares about) does, so this is a test
// environment gap, not app behavior to work around — polyfill it once here
// rather than guarding every hook that reads prefers-reduced-motion.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
