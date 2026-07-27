import {
  formatSecondsToMinSecMs,
  parseMinSecMsToSeconds,
} from '../../utils/time.js';

function renderTranslationBar({ row, rowDiv, rerender }) {
  let transBar = rowDiv.querySelector('.lyric-row-translation-bar');
  if (!transBar) {
    transBar = document.createElement('div');
    transBar.className = 'lyric-row-translation-bar';
    rowDiv.appendChild(transBar);
  }

  if (row.translation !== null && row.translation !== undefined) {
    transBar.innerHTML = `
      <span class="translation-label">译</span>
      <input type="text" class="translation-input" value="${row.translation}" placeholder="请输入行翻译内容" />
      <button class="btn-translation-delete" title="删除行翻译">&times;</button>
    `;

    transBar.querySelector('.translation-input').addEventListener('change', event => {
      row.translation = event.target.value;
    });

    transBar.querySelector('.btn-translation-delete').addEventListener('click', () => {
      row.translation = null;
      row.translationTime = null;
      renderTranslationBar({ row, rowDiv, rerender });
    });
  } else {
    transBar.innerHTML = '<button class="btn-translation-add">+ 添加行翻译</button>';
    transBar.querySelector('.btn-translation-add').addEventListener('click', () => {
      row.translation = '';
      row.translationTime = row.time;
      renderTranslationBar({ row, rowDiv, rerender });
    });
  }
}

function positionBubbleEditor({ bubbleEditor, card, word }) {
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
    const newSec = parseMinSecMsToSeconds(event.target.value);
    word.time = newSec;
    event.target.value = formatSecondsToMinSecMs(newSec);
    card.querySelector('.start').textContent = formatSecondsToMinSecMs(newSec);
  };

  endInput.onchange = event => {
    const endSec = parseMinSecMsToSeconds(event.target.value);
    word.duration = Math.max(0, endSec - word.time);
    event.target.value = formatSecondsToMinSecMs(word.time + word.duration);
    card.querySelector('.end').textContent = formatSecondsToMinSecMs(word.time + word.duration);
  };

  textInput.onchange = event => {
    word.text = event.target.value;
    card.querySelector('.word-text-display').textContent = event.target.value;
  };

  bubbleEditor.style.left = `${rect.left + rect.width / 2 + scrollLeft}px`;
  bubbleEditor.style.top = `${rect.top + scrollTop - 12}px`;
  bubbleEditor.classList.add('active');
}

function renderTimedRow({ row, rowIndex, lyricsList, rowDiv, bubbleEditor, rerender }) {
  rowDiv.className = 'lyric-row-item';
  rowDiv.setAttribute('data-row-idx', rowIndex);

  const activeTag = row.tag || '';
  rowDiv.innerHTML = `
    <div class="lyric-row-header">
      <div class="lyric-row-meta-left">
        <span class="lyric-row-number">${rowIndex + 1}</span>
        <div class="lyric-row-id-group">
          <button class="lyric-row-id-btn${activeTag === 'v1' ? ' active' : ''}" data-tag="v1">v1</button>
          <button class="lyric-row-id-btn${activeTag === '合唱' ? ' active' : ''}" data-tag="合唱">合唱</button>
          <button class="lyric-row-id-btn${activeTag === '和声' ? ' active' : ''}" data-tag="和声">和声</button>
          <button class="lyric-row-id-btn${activeTag === '段落' ? ' active' : ''}" data-tag="段落">段落</button>
        </div>
      </div>
      <button class="btn-row-remove" title="删除整行">删除行</button>
    </div>
    <div class="lyric-word-grid"></div>
  `;

  const grid = rowDiv.querySelector('.lyric-word-grid');
  row.words.forEach((word, wordIndex) => {
    const card = document.createElement('div');
    card.className = 'word-unit-card';
    card.setAttribute('data-word-idx', wordIndex);
    const startTimeStr = formatSecondsToMinSecMs(word.time);
    const endTimeStr = formatSecondsToMinSecMs(word.time + (word.duration || 0));

    card.innerHTML = `
      <span class="word-time-badge start">${startTimeStr}</span>
      <div class="word-text-display">${word.text || ''}</div>
      <span class="word-time-badge end">${endTimeStr}</span>
    `;

    card.addEventListener('click', event => {
      event.stopPropagation();
      document.querySelectorAll('.word-unit-card.active').forEach(node => node.classList.remove('active'));
      card.classList.add('active');
      positionBubbleEditor({ bubbleEditor, card, word });
    });

    grid.appendChild(card);
  });

  rowDiv.querySelector('.btn-row-remove').addEventListener('click', () => {
    lyricsList.splice(rowIndex, 1);
    rerender();
  });

  rowDiv.querySelectorAll('.lyric-row-id-btn').forEach(button => {
    button.addEventListener('click', event => {
      const tag = event.target.getAttribute('data-tag');
      if (row.tag === tag) {
        row.tag = '';
        event.target.classList.remove('active');
      } else {
        row.tag = tag;
        rowDiv.querySelectorAll('.lyric-row-id-btn').forEach(node => node.classList.remove('active'));
        event.target.classList.add('active');
      }
    });
  });

  renderTranslationBar({ row, rowDiv, rerender });
}

function renderPlainRow({ row, rowIndex, lyricsList, rowDiv, rerender }) {
  rowDiv.className = 'lrc-row-item-container';
  rowDiv.innerHTML = `
    <div class="lrc-row-item" data-row-idx="${rowIndex}">
      <input type="text" class="lrc-time-input" value="${formatSecondsToMinSecMs(row.time)}" />
      <input type="text" class="lrc-text-input" value="${row.text || ''}" placeholder="歌词文本" />
      <button class="btn-row-remove" title="删除此行">删除</button>
    </div>
  `;

  rowDiv.querySelector('.lrc-time-input').addEventListener('change', event => {
    const newSec = parseMinSecMsToSeconds(event.target.value);
    row.time = newSec;
    event.target.value = formatSecondsToMinSecMs(newSec);
  });

  rowDiv.querySelector('.lrc-text-input').addEventListener('change', event => {
    row.text = event.target.value;
  });

  rowDiv.querySelector('.btn-row-remove').addEventListener('click', () => {
    lyricsList.splice(rowIndex, 1);
    rerender();
  });

  renderTranslationBar({ row, rowDiv, rerender });
}

export function renderLyricsTimeline({ lyricsList, bubbleEditor }) {
  const viewport = document.getElementById('lyrics-editor-viewport');
  if (!viewport) return;

  const rerender = () => renderLyricsTimeline({ lyricsList, bubbleEditor });
  viewport.innerHTML = '';

  if (!lyricsList || lyricsList.length === 0) {
    viewport.innerHTML = '<div class="lyrics-editor-loading">暂无歌词数据</div>';
    return;
  }

  lyricsList.forEach((row, rowIndex) => {
    const rowDiv = document.createElement('div');

    if (row.words && Array.isArray(row.words)) {
      renderTimedRow({ row, rowIndex, lyricsList, rowDiv, bubbleEditor, rerender });
    } else {
      renderPlainRow({ row, rowIndex, lyricsList, rowDiv, rerender });
    }

    viewport.appendChild(rowDiv);
  });
}
