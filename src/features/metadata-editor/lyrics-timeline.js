import {
  formatSecondsToMinSecMs,
  parseMinSecMsToSeconds,
} from '../../utils/time.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getRoleTokens(row) {
  return String(row.role || row.tag || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function getLane(row) {
  const role = getRoleTokens(row).join(' ').toLowerCase();
  if (/(?:^|\s|-)(?:l2|v2)(?:$|\s|-)/.test(role)) return 'v2';
  if (/(?:^|\s|-)(?:l1|v1)(?:$|\s|-)/.test(role)) return 'v1';
  return '';
}

function isBackgroundRow(row) {
  return Boolean(row.isBackground)
    || getRoleTokens(row).some(token => /(?:xr-)?bg|background/i.test(token));
}

function setRowLane(row, lane) {
  const retained = getRoleTokens(row)
    .filter(token => !/^(?:l1|l2|v1|v2)$/i.test(token));
  if (lane) retained.unshift(lane);
  row.role = retained.join(' ');
  row.tag = row.role;
}

function setBackgroundRow(row, enabled) {
  const retained = getRoleTokens(row)
    .filter(token => !/^(?:x-?r?-?bg|bg|background)$/i.test(token));
  if (enabled) retained.push('xr-BG');
  row.isBackground = enabled;
  row.role = retained.join(' ');
  row.tag = row.role;
}

function renderTranslationBar({ row, rowDiv }) {
  let transBar = rowDiv.querySelector('.lyric-row-translation-bar');
  if (!transBar) {
    transBar = document.createElement('div');
    transBar.className = 'lyric-row-translation-bar';
    rowDiv.appendChild(transBar);
  }

  if (row.translation !== null && row.translation !== undefined) {
    transBar.innerHTML = `
      <span class="translation-label">译</span>
      <input type="text" class="translation-input" value="${escapeHtml(row.translation)}" placeholder="输入这一行的翻译" />
      <button class="btn-translation-delete" title="移除翻译" aria-label="移除翻译">&times;</button>
    `;
    transBar.querySelector('.translation-input').addEventListener('input', event => {
      row.translation = event.target.value;
    });
    transBar.querySelector('.btn-translation-delete').addEventListener('click', () => {
      row.translation = null;
      row.translationTime = null;
      renderTranslationBar({ row, rowDiv });
    });
    return;
  }

  transBar.innerHTML = '<button class="btn-translation-add">+ 添加翻译</button>';
  transBar.querySelector('.btn-translation-add').addEventListener('click', () => {
    row.translation = '';
    row.translationTime = row.time;
    renderTranslationBar({ row, rowDiv });
    rowDiv.querySelector('.translation-input')?.focus();
  });
}

function renderRowHeader({ row, rowIndex, lyricsList, rowDiv, rerender }) {
  const lane = getLane(row);
  const background = isBackgroundRow(row);

  const header = document.createElement('div');
  header.className = 'lyric-row-header';
  header.innerHTML = `
    <div class="lyric-row-meta-left">
      <span class="lyric-row-number">${rowIndex + 1}</span>
      <div class="lyric-row-id-group" aria-label="歌词声部">
        <button class="lyric-row-id-btn${lane === 'v1' ? ' active' : ''}" data-lane="v1">左侧</button>
        <button class="lyric-row-id-btn${lane === 'v2' ? ' active' : ''}" data-lane="v2">右侧</button>
        <button class="lyric-row-id-btn background-toggle${background ? ' active' : ''}" data-background="true">背景</button>
      </div>
    </div>
    <button class="btn-row-remove" title="删除整行">删除</button>
  `;

  header.querySelectorAll('[data-lane]').forEach(button => {
    button.addEventListener('click', () => {
      const selectedLane = button.dataset.lane || '';
      setRowLane(row, lane === selectedLane ? '' : selectedLane);
      rerender();
    });
  });
  header.querySelector('[data-background]').addEventListener('click', () => {
    setBackgroundRow(row, !isBackgroundRow(row));
    rerender();
  });
  header.querySelector('.btn-row-remove').addEventListener('click', () => {
    lyricsList.splice(rowIndex, 1);
    rerender();
  });

  rowDiv.appendChild(header);
}

function positionBubbleEditor({ bubbleEditor, card, word, row, wordIndex, wordCount }) {
  const rect = card.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  const startInput = bubbleEditor.querySelector('.start');
  const textInput = bubbleEditor.querySelector('.text');
  const endInput = bubbleEditor.querySelector('.end');

  startInput.value = formatSecondsToMinSecMs(word.time);
  textInput.value = word.text || '';
  endInput.value = formatSecondsToMinSecMs(word.time + (word.duration || 0));

  startInput.onchange = event => {
    const oldEnd = word.time + (word.duration || 0);
    const newSec = parseMinSecMsToSeconds(event.target.value);
    word.time = newSec;
    word.duration = Math.max(0, oldEnd - newSec);
    if (wordIndex === 0) row.time = newSec;
    event.target.value = formatSecondsToMinSecMs(newSec);
    card.querySelector('.start').textContent = formatSecondsToMinSecMs(newSec);
  };

  endInput.onchange = event => {
    const endSec = parseMinSecMsToSeconds(event.target.value);
    word.duration = Math.max(0, endSec - word.time);
    if (wordIndex === wordCount - 1) row.end = endSec;
    event.target.value = formatSecondsToMinSecMs(word.time + word.duration);
    card.querySelector('.end').textContent = formatSecondsToMinSecMs(word.time + word.duration);
  };

  textInput.oninput = event => {
    word.text = event.target.value;
    card.querySelector('.word-text-display').textContent = event.target.value;
  };

  bubbleEditor.style.left = `${rect.left + rect.width / 2 + scrollLeft}px`;
  bubbleEditor.style.top = `${rect.top + scrollTop - 12}px`;
  bubbleEditor.classList.add('active');
}

function renderTimedRow({ row, rowIndex, lyricsList, rowDiv, bubbleEditor, rerender }) {
  rowDiv.className = `lyric-row-item${isBackgroundRow(row) ? ' is-background-row' : ''}`;
  rowDiv.dataset.rowIdx = String(rowIndex);
  renderRowHeader({ row, rowIndex, lyricsList, rowDiv, rerender });

  const grid = document.createElement('div');
  grid.className = 'lyric-word-grid';
  row.words.forEach((word, wordIndex) => {
    const card = document.createElement('div');
    card.className = 'word-unit-card';
    card.dataset.wordIdx = String(wordIndex);
    const startTimeStr = formatSecondsToMinSecMs(word.time);
    const endTimeStr = formatSecondsToMinSecMs(word.time + (word.duration || 0));
    card.innerHTML = `
      <span class="word-time-badge start">${startTimeStr}</span>
      ${word.ruby ? `<span class="word-ruby-display">${escapeHtml(word.ruby)}</span>` : ''}
      <div class="word-text-display">${escapeHtml(word.text || '')}</div>
      <span class="word-time-badge end">${endTimeStr}</span>
    `;
    card.addEventListener('click', event => {
      event.stopPropagation();
      document.querySelectorAll('.word-unit-card.active').forEach(node => node.classList.remove('active'));
      card.classList.add('active');
      positionBubbleEditor({
        bubbleEditor,
        card,
        word,
        row,
        wordIndex,
        wordCount: row.words.length,
      });
    });
    grid.appendChild(card);
  });
  rowDiv.appendChild(grid);
  renderTranslationBar({ row, rowDiv });
}

function renderPlainRow({ row, rowIndex, lyricsList, rowDiv, rerender }) {
  rowDiv.className = `lrc-row-item-container${isBackgroundRow(row) ? ' is-background-row' : ''}`;
  renderRowHeader({ row, rowIndex, lyricsList, rowDiv, rerender });

  const content = document.createElement('div');
  content.className = 'lrc-row-item';
  content.innerHTML = `
    <input type="text" class="lrc-time-input" value="${formatSecondsToMinSecMs(row.time)}" aria-label="开始时间" />
    <input type="text" class="lrc-text-input" value="${escapeHtml(row.text || '')}" placeholder="歌词文本" />
  `;
  content.querySelector('.lrc-time-input').addEventListener('change', event => {
    const newSec = parseMinSecMsToSeconds(event.target.value);
    row.time = newSec;
    event.target.value = formatSecondsToMinSecMs(newSec);
  });
  content.querySelector('.lrc-text-input').addEventListener('input', event => {
    row.text = event.target.value;
  });
  rowDiv.appendChild(content);
  renderTranslationBar({ row, rowDiv });
}

export function renderLyricsTimeline({ lyricsList, bubbleEditor }) {
  const viewport = document.getElementById('lyrics-editor-viewport');
  if (!viewport) return;

  const rerender = () => renderLyricsTimeline({ lyricsList, bubbleEditor });
  viewport.innerHTML = '';

  const rowCount = document.getElementById('lyrics-row-count');
  if (rowCount) rowCount.textContent = `${lyricsList?.length || 0} 行`;

  if (!lyricsList || lyricsList.length === 0) {
    viewport.innerHTML = '<div class="lyrics-editor-loading">没有可编辑的歌词数据</div>';
    return;
  }

  lyricsList.forEach((row, rowIndex) => {
    const rowDiv = document.createElement('section');
    if (row.words && Array.isArray(row.words) && row.words.length > 0) {
      renderTimedRow({ row, rowIndex, lyricsList, rowDiv, bubbleEditor, rerender });
    } else {
      renderPlainRow({ row, rowIndex, lyricsList, rowDiv, rerender });
    }
    viewport.appendChild(rowDiv);
  });
}
