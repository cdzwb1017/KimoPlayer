export function updateMarqueeState(element) {
  if (!element) return;
  element.classList.remove('is-marquee', 'is-seamless-marquee');
  element.style.removeProperty('--marquee-duration');

  // 音质微标不参与跑马灯滚动
  const cls = element.className || '';
  if (cls.includes('badge')) {
    return;
  }

  // 获取原始纯文本
  const originalText = element.getAttribute('data-original-text') || element.textContent.trim();
  if (!element.hasAttribute('data-original-text')) {
    element.setAttribute('data-original-text', originalText);
  }

  // 恢复单份进行精确宽度测量
  element.textContent = originalText;

  const parent = element.parentElement;
  const parentWidth = parent ? parent.clientWidth : element.clientWidth;

  element.style.maxWidth = 'none';
  element.style.display = 'inline-block';
  element.style.textOverflow = 'clip';
  const contentWidth = element.scrollWidth;
  element.style.removeProperty('max-width');
  element.style.removeProperty('display');
  element.style.removeProperty('text-overflow');

  if (contentWidth > parentWidth + 2) {
    // 构造双份无缝衔接轨道 (Seamless Loop Track)，无限无回弹地连续向左平滑滑动
    const spacer = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
    // 外层 .marquee-mask 固定不动，承载遮罩和裁剪；内层 .is-seamless-marquee 承载动画
    element.innerHTML = `<span class="marquee-mask"><span class="is-seamless-marquee"><span class="marquee-inner">${originalText}${spacer}</span><span class="marquee-inner" aria-hidden="true">${originalText}${spacer}</span></span></span>`;

    // 根据文本长度自动设定平滑匀速滚动时长
    const singleWidth = contentWidth + 36;
    const duration = Math.max(8, Math.min(30, singleWidth / 22));

    element.style.setProperty('--marquee-duration', `${duration}s`);
    void element.offsetWidth; // 触发重绘
  }
}

export function transitionContent(element, content, isImage = false) {
  if (!element) return;

  if (isImage) {
    const currentSrc = element.src ? new URL(element.src, window.location.href).href : '';
    const targetSrc = content ? new URL(content, window.location.href).href : '';
    if (currentSrc === targetSrc) return;
  } else if (element.innerHTML === content || element.innerText === content) {
    updateMarqueeState(element);
    return;
  }

  element.classList.add('changing');
  setTimeout(() => {
    element.removeAttribute('data-original-text');
    if (isImage) {
      element.src = content;
    } else {
      if (typeof content === 'string' && content.includes('<') && content.includes('>')) {
        element.innerHTML = content;
      } else {
        element.innerText = content;
      }
      updateMarqueeState(element);
    }
    element.classList.remove('changing');
  }, 350);
}
