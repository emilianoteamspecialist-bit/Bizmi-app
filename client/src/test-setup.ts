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
