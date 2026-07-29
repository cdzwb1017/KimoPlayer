export function initializeContentAreaWheelFix() {
  // 仅拦截设置页等 content-area 内的滚轮事件，排除子级可滚动容器
  window.addEventListener('wheel', (e) => {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) return;
    if (!contentArea.contains(e.target)) return;
    if (contentArea.scrollHeight <= contentArea.clientHeight) return;

    // 子级可滚动容器（如模态框、滑块、日志面板）交给浏览器原生处理
    const scrollableChild = e.target.closest('.ai-console-logs, .kimo-modal-body, input[type="range"]');
    if (scrollableChild) return;

    // 阻止原生逐帧跳动，改用平滑滚动
    e.preventDefault();
    contentArea.scrollBy({
      top: e.deltaY,
      behavior: 'smooth',
    });
  }, { passive: false });
}
