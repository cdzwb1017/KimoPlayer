export function initializeContentAreaWheelFix() {
  window.addEventListener('wheel', (e) => {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) return;
    if (!contentArea.contains(e.target)) return;
    if (contentArea.scrollHeight <= contentArea.clientHeight) return;

    const scrollableChild = e.target.closest('.ai-console-logs, .kimo-modal-body, input[type="range"]');
    if (!scrollableChild) {
      contentArea.scrollTop += e.deltaY;
    }
  }, { passive: true });
}
