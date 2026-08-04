function closeModalWithFade(modal) {
  const overlay = modal.closest('.kimo-modal-overlay');
  const card = modal.closest('.kimo-modal-card');
  if (overlay) overlay.style.opacity = '0';
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9) translateY(20px)';
  }
  setTimeout(() => modal.remove(), 200);
}

function formatTime(secs) {
  const minutes = Math.floor(secs / 60).toString().padStart(2, '0');
  const seconds = Math.floor(secs % 60).toString().padStart(2, '0');
  const milliseconds = Math.floor((secs % 1) * 1000).toString().padStart(3, '0').substring(0, 3);
  return `${minutes}:${seconds}.${milliseconds}`;
}

export function showCalibrationModal({ line, lineIndex, onClose, onRun }) {
  const oldModal = document.getElementById('kimo-calibration-modal');
  if (oldModal) oldModal.remove();

  const modal = document.createElement('div');
  modal.id = 'kimo-calibration-modal';
  modal.className = 'kimo-modal-overlay';

  modal.innerHTML = `
    <div class="kimo-modal-card">
      <div class="kimo-modal-header">
        <div class="kimo-modal-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 8px; animation: sparkles-spin 4s linear infinite; color:var(--accent);"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          AI 时间戳单句精密校准
        </div>
        <button class="kimo-modal-close" id="kimo-modal-close-btn">&times;</button>
      </div>
      <div class="kimo-modal-body" id="kimo-modal-body-content">
        <div class="kimo-loading-wrapper">
          <div class="kimo-spinner"></div>
          <div class="kimo-loading-text">正在提取发音特征并执行校准，请稍候...</div>
          <div class="kimo-loading-subtext">"${line.text}"</div>
        </div>
      </div>
      <div class="kimo-modal-footer" id="kimo-modal-footer-btns" style="display:none;">
        <button class="kimo-modal-btn cancel" id="kimo-btn-discard">放弃修改</button>
        <button class="kimo-modal-btn apply" id="kimo-btn-apply">应用校准</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('#kimo-modal-close-btn').addEventListener('click', () => {
    closeModalWithFade(modal);
    onClose?.();
  });

  onRun(line, lineIndex, modal);
}

export async function runSingleLineAlignment({
  line,
  lineIndex,
  modal,
  lines,
  audioPath,
  invoke,
  onApply,
}) {
  const bodyContent = modal.querySelector('#kimo-modal-body-content');
  const footerBtns = modal.querySelector('#kimo-modal-footer-btns');

  try {
    const nextLine = lines[lineIndex + 1];
    const endTime = line.endTime || (nextLine ? nextLine.time : line.time + 4.0);
    const serverUrl = localStorage.getItem('kimo-ai-server-url') || 'http://127.0.0.1:8000';
    const responseStr = await invoke('ai_align_single_line', {
      audioPath,
      text: line.text,
      startTime: line.time,
      endTime,
      serverUrl,
    });

    const result = JSON.parse(responseStr);
    if (!result.success || !result.syllables) {
      throw new Error('后端校准未能生成对齐字词数据');
    }

    renderCalibrationDiff({
      line,
      aiSyllables: result.syllables,
      bodyEl: bodyContent,
      footerEl: footerBtns,
      modalEl: modal,
      onApply,
    });
  } catch (err) {
    console.error('[AI Alignment Error]', err);
    bodyContent.innerHTML = `
      <div style="text-align:center; padding: 30px; color:var(--system-red);">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:10px;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <div style="font-weight:600; font-size:16px;">AI 单句精密校准失败</div>
        <div style="font-size:12px; margin-top:8px; opacity:0.8;">错误原因: ${err.message || err}</div>
      </div>
    `;
  }
}

export function renderCalibrationDiff({ line, aiSyllables, bodyEl, footerEl, modalEl, onApply }) {
  bodyEl.innerHTML = '';

  const previewHeader = document.createElement('div');
  previewHeader.className = 'kimo-diff-preview-header';
  previewHeader.innerHTML = `
    <div class="kimo-diff-text-title">"${line.text}"</div>
    <div class="kimo-diff-sub-desc">已完成发音波形对齐，请检查以下时间戳微调。</div>
  `;
  bodyEl.appendChild(previewHeader);

  const table = document.createElement('div');
  table.className = 'kimo-diff-table';

  const tHeader = document.createElement('div');
  tHeader.className = 'kimo-diff-row header';
  tHeader.innerHTML = `
    <span class="col-char">字词</span>
    <span class="col-orig"><span>原始时间</span></span>
    <span class="col-arrow"></span>
    <span class="col-new"><span>AI 校准后</span></span>
    <span class="col-delta">偏差微调</span>
  `;
  table.appendChild(tHeader);

  const oldWords = line.words || [];
  aiSyllables.forEach((item, charIndex) => {
    const originalItem = oldWords[charIndex];
    const originalTime = originalItem ? formatTime(originalItem.time) : '未对齐';
    const newTime = formatTime(item.time);
    let deltaText = '新对齐';
    let deltaClass = 'new-aligned';

    if (originalItem) {
      const deltaMs = Math.round((item.time - originalItem.time) * 1000);
      if (Math.abs(deltaMs) < 5) {
        deltaText = '吻合';
        deltaClass = 'perfect';
      } else if (deltaMs > 0) {
        deltaText = `+${deltaMs}ms`;
        deltaClass = 'delay';
      } else {
        deltaText = `${deltaMs}ms`;
        deltaClass = 'early';
      }
    }

    const row = document.createElement('div');
    row.className = 'kimo-diff-row';
    row.innerHTML = `
      <span class="col-char">${item.text}</span>
      <span class="col-orig">${originalTime}</span>
      <span class="col-arrow">→</span>
      <span class="col-new">${newTime}</span>
      <span class="col-delta ${deltaClass}">${deltaText}</span>
    `;
    table.appendChild(row);
  });

  bodyEl.appendChild(table);
  footerEl.style.display = 'flex';

  modalEl.querySelector('#kimo-btn-discard').addEventListener('click', () => modalEl.remove());
  modalEl.querySelector('#kimo-btn-apply').addEventListener('click', () => {
    onApply(aiSyllables, modalEl);
  });
}

export function saveLyricsCache({ audioPath, lines, invoke }) {
  if (!audioPath) return;

  try {
    const exportLines = lines
      .filter(line => !line.isInterlude)
      .map(line => {
        const syllables = (line.words || []).map(word => ({
          time: word.time,
          duration: Number.isFinite(word.duration) && word.duration > 0 ? word.duration : null,
          end: Number.isFinite(word.end) && word.end > word.time ? word.end : null,
          text: word.text,
          // 振假名：优先保留 ruby（LunaBeat 上 romanWord/transliteration 已经注入这里）
          // 同时把 romanWord / transliteration 字段也落盘，方便后续做诊断或兼容其他 parser
          ruby: word.ruby || null,
          romanWord: word.romanWord || null,
          transliteration: word.transliteration || null,
          isBackground: Boolean(word.isBackground) ? true : undefined,
          spaceAfter: word.spaceAfter ? true : undefined,
          spaceBefore: word.spaceBefore ? true : undefined,
        }));
        return {
          time: line.time,
          end: Number.isFinite(line.end) && line.end > line.time ? line.end : (Number.isFinite(line.endTime) && line.endTime > line.time ? line.endTime : null),
          text: line.text,
          translation: line.translation || null,
          romanLyric: line.romanLyric || null,
          isBG: line.isBG ? true : undefined,
          isDuet: line.isDuet ? true : undefined,
          syllables,
          // 旧格式的 words 字段也保留，方便老版本代码读回
          words: syllables,
        };
      });

    const payload = {
      success: true,
      lyrics: exportLines,
      // 也塞一份 data.lines，让 parseJSONLyrics 的 LunaBeat 分支也能直接读到
      lines: exportLines,
      format: 'kimo-player-v2',
    };

    invoke('save_lyrics_cache', {
      audioPath,
      jsonContent: JSON.stringify(payload, null, 2),
    }).catch(error => console.error('[Save Cache Failed]', error));
  } catch (error) {
    console.error('[Lyrics Cache Save Error]', error);
  }
}
