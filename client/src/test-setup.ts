import "@testing-library/jest-dom/vitest"

// jsdom implements neither the Pointer Events capture API nor scrollIntoView.
// Radix UI's click-to-open triggers (DropdownMenu, Select, etc.) call these,
// so without stubs `userEvent.click()` hangs indefinitely or throws in jsdom.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// jsdom has no IntersectionObserver. framer-motion's `whileInView` (used by
// the shared Reveal component) requires it to mount at all, so without a
// stub any component wrapped in <Reveal> throws "IntersectionObserver is
// not defined" during render.
if (!("IntersectionObserver" in globalThis)) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null
    readonly rootMargin: string = ""
    readonly thresholds: ReadonlyArray<number> = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  // @ts-expect-error jsdom test environment stub, not a spec-accurate implementation
  globalThis.IntersectionObserver = MockIntersectionObserver
}
