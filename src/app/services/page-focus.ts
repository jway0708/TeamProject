// Release focus before Ionic hides the outgoing page, including shadow DOM inputs.
export function releasePageFocus(): void {
  let focused: Element | null = document.activeElement;
  while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
  if (focused instanceof HTMLElement) focused.blur();
}
