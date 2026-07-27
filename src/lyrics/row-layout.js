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

  const domLineRect = domLine.getBoundingClientRect();
  const firstRect = words[0].getBoundingClientRect();
  const lastRect = words[words.length - 1].getBoundingClientRect();

  domLine._prevFirstRelativeTop = firstRect.top - domLineRect.top;
  domLine._prevLastRelativeTop = lastRect.top - domLineRect.top;

  const rowGroups = [];
  words.forEach(word => {
    const y = word.getBoundingClientRect().top - domLineRect.top;
    const foundGroup = rowGroups.find(group => Math.abs(group[0]._relativeTop - y) < rowThresholdPx);

    if (foundGroup) {
      foundGroup.push(word);
    } else {
      word._relativeTop = y;
      rowGroups.push([word]);
    }
  });

  rowGroups.sort((a, b) => a[0]._relativeTop - b[0]._relativeTop);

  const rowsData = [];
  let allValid = true;

  rowGroups.forEach((rowWords, rowIndex) => {
    rowWords.sort((a, b) => a.offsetLeft - b.offsetLeft);

    const firstWord = rowWords[0];
    const lastWord = rowWords[rowWords.length - 1];
    const rowLeft = firstWord.offsetLeft;
    const rowRight = lastWord.offsetLeft + lastWord.offsetWidth;
    const rowWidth = rowRight - rowLeft;

    if (rowWidth <= 0) {
      allValid = false;
    }

    const widthToUse = rowWidth || 300;

    rowWords.forEach(word => {
      word.style.setProperty('--line-width', `${widthToUse}px`);

      const baseOffset = word.offsetLeft - rowLeft;
      word.style.setProperty('--char-offset', `${baseOffset}px`);

      const suffixNode = word.querySelector('.lyrics-ruby-suffix');
      if (suffixNode) {
        const suffixOffset = baseOffset + suffixNode.offsetLeft;
        suffixNode.style.setProperty('--char-offset', `${suffixOffset}px`);
      }

      word.style.setProperty('--glow-left-pct', ((70 / widthToUse) * 100).toFixed(3));
      word.style.setProperty('--glow-right-pct', ((50 / widthToUse) * 100).toFixed(3));
      word.style.setProperty('--glow-mid-pct', ((20 / widthToUse) * 100).toFixed(3));
      word.dataset.rowIndex = rowIndex;
    });

    rowsData.push({
      rowIndex,
      left: rowLeft,
      width: widthToUse,
      words: rowWords,
      startIdx: words.indexOf(firstWord),
      endIdx: words.indexOf(lastWord),
    });
  });

  domLine.rowsData = rowsData;

  if (allValid && rowsData.length > 0) {
    domLine.dataset.bgAligned = 'true';
  }

  return true;
}
