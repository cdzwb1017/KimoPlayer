/**
 * 歌词行物理排版对齐 —— 计算逐字物理位置，为整行拼接渐变卡拉OK提供像素级数据。
 *
 * 参考 AMLL 架构：使用 getBoundingClientRect() 获取子像素精度的位置/宽度，
 * 而非 offsetLeft/offsetWidth（整数像素，精度损失）。
 */
export function alignLyricRows(domLine, words, { force = false, rowThresholdPx = 15 } = {}) {
  let needRealign = !domLine.rowsData
    || domLine.dataset.bgAligned !== 'true'
    || domLine.rowsData.some(row => row.width <= 0);

  if (force) {
    needRealign = true;
  }

  if (!needRealign || words.length === 0) {
    return false;
  }

  const wordList = Array.from(words);
  const domLineRect = domLine.getBoundingClientRect();
  const wordMetrics = wordList.map((word, index) => {
    const rect = word.getBoundingClientRect();
    const suffixNode = word.querySelector('.lyrics-ruby-suffix');
    const suffixRect = suffixNode ? suffixNode.getBoundingClientRect() : null;
    return {
      word,
      index,
      // 子像素精度：使用 getBoundingClientRect 而非 offsetLeft/offsetWidth（整数截断）
      relativeTop: rect.top - domLineRect.top,
      preciseLeft: rect.left - domLineRect.left,
      preciseWidth: rect.width,
      preciseRight: rect.right - domLineRect.left,
      suffixNode,
      suffixPreciseLeft: suffixRect ? suffixRect.left - domLineRect.left : 0,
      suffixPreciseWidth: suffixRect ? suffixRect.width : 0,
    };
  });

  domLine._prevFirstRelativeTop = wordMetrics[0].relativeTop;
  domLine._prevLastRelativeTop = wordMetrics[wordMetrics.length - 1].relativeTop;

  // 按纵向位置分组（检测换行）
  const rowGroups = [];
  wordMetrics.forEach(metric => {
    const foundGroup = rowGroups.find(group => Math.abs(group[0].relativeTop - metric.relativeTop) < rowThresholdPx);
    if (foundGroup) {
      foundGroup.push(metric);
    } else {
      rowGroups.push([metric]);
    }
  });

  rowGroups.sort((a, b) => a[0].relativeTop - b[0].relativeTop);

  const rowsData = [];
  const styleUpdates = [];
  let allValid = true;

  rowGroups.forEach((rowMetrics, rowIndex) => {
    rowMetrics.sort((a, b) => a.preciseLeft - b.preciseLeft);

    const firstMetric = rowMetrics[0];
    const lastMetric = rowMetrics[rowMetrics.length - 1];
    // 子像素精度的行边界
    const rowLeft = firstMetric.preciseLeft;
    const rowRight = lastMetric.preciseRight;
    const rowWidth = rowRight - rowLeft;

    if (rowWidth <= 0) {
      allValid = false;
    }

    const widthToUse = rowWidth || 300;

    // 构建行数据，包含每个字的子像素精度位置
    const rowWordData = rowMetrics.map(metric => ({
      word: metric.word,
      index: metric.index,
      // 相对于行左侧的精确偏移和宽度
      offsetLeft: metric.preciseLeft - rowLeft,
      offsetWidth: metric.preciseWidth,
      offsetRight: metric.preciseRight - rowLeft,
    }));

    rowMetrics.forEach(metric => {
      const baseOffset = metric.preciseLeft - rowLeft;
      styleUpdates.push({
        metric,
        rowIndex,
        baseOffset,
        widthToUse,
      });
    });

    rowsData.push({
      rowIndex,
      left: rowLeft,
      width: widthToUse,
      words: rowMetrics.map(metric => metric.word),
      wordData: rowWordData,
      startIdx: firstMetric.index,
      endIdx: lastMetric.index,
    });
  });

  styleUpdates.forEach(({ metric, rowIndex, baseOffset, widthToUse }) => {
    const { word, suffixNode, suffixPreciseLeft } = metric;
    word.style.setProperty('--line-width', `${widthToUse}px`);
    word.style.setProperty('--char-offset', `${baseOffset}px`);

    if (suffixNode) {
      const suffixBaseOffset = suffixPreciseLeft - (rowsData[rowIndex]?.left ?? 0);
      suffixNode.style.setProperty('--char-offset', `${suffixBaseOffset}px`);
    }

    word.style.setProperty('--glow-left-pct', ((70 / widthToUse) * 100).toFixed(3));
    word.style.setProperty('--glow-right-pct', ((50 / widthToUse) * 100).toFixed(3));
    word.style.setProperty('--glow-mid-pct', ((20 / widthToUse) * 100).toFixed(3));
    word.dataset.rowIndex = rowIndex;
  });

  domLine.rowsData = rowsData;

  if (allValid && rowsData.length > 0) {
    // Keep bgAligned off so --char-fill karaoke mode runs cleanly without stale line-percent overrides
  }

  return true;
}
