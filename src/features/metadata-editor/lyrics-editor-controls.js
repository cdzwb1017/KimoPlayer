export function bindLyricsEditorControls({
  openFile,
  readTextFile,
  parseLyrics,
  renderTimeline,
  serializeWorkspace,
  showToast,
  getLyrics,
  setLyrics,
  getLyricsType,
  getEditorMode,
  setEditorMode,
}) {
  document.getElementById('btn-lyrics-import')?.addEventListener('click', async () => {
    try {
      const selected = await openFile({
        multiple: false,
        filters: [{
          name: 'Lyrics Files',
          extensions: ['lrc', 'ttml', 'txt'],
        }],
      });

      if (!selected) return;

      const content = await readTextFile(selected);
      if (!content || !content.trim()) {
        showToast('歌词文件为空');
        return;
      }

      const list = parseLyrics(content);
      if (!list || list.length === 0) {
        showToast('歌词解析失败，请检查格式');
        return;
      }

      setLyrics(list);
      const textarea = document.getElementById('edit-metadata-lyrics');
      if (textarea) textarea.value = content;
      renderTimeline(list);
      showToast('成功导入外部歌词文件');
    } catch (err) {
      console.error('[MetadataEditor] Failed to import external lyrics:', err);
      showToast('导入歌词文件失败');
    }
  });

  document.getElementById('btn-lyrics-raw-toggle')?.addEventListener('click', () => {
    const rawContainer = document.getElementById('lyrics-editor-raw-container');
    const viewport = document.getElementById('lyrics-editor-viewport');
    const textarea = document.getElementById('edit-metadata-lyrics');
    const toggleBtn = document.getElementById('btn-lyrics-raw-toggle');
    const addLineBtn = document.getElementById('btn-lyrics-add-line');

    if (getEditorMode() === 'timeline') {
      if (textarea) textarea.value = serializeWorkspace();
      if (viewport) viewport.style.display = 'none';
      if (rawContainer) rawContainer.style.display = 'block';
      if (toggleBtn) toggleBtn.textContent = '切换图形时间轴';
      if (addLineBtn) addLineBtn.style.display = 'none';
      setEditorMode('raw');
      return;
    }

    const list = parseLyrics(textarea?.value || '');
    setLyrics(list);
    renderTimeline(list);
    if (rawContainer) rawContainer.style.display = 'none';
    if (viewport) viewport.style.display = 'block';
    if (toggleBtn) toggleBtn.textContent = '切换纯文本编辑';
    if (addLineBtn) {
      addLineBtn.style.display = getLyricsType() === 'lrc' ? 'inline-block' : 'none';
    }
    setEditorMode('timeline');
  });

  document.getElementById('btn-lyrics-add-line')?.addEventListener('click', () => {
    const lyrics = getLyrics();
    if (getLyricsType() !== 'lrc' || !lyrics) return;

    const lastTime = lyrics.length > 0 ? lyrics[lyrics.length - 1].time + 5 : 0;
    lyrics.push({ time: lastTime, text: '新歌词行' });
    renderTimeline(lyrics);
  });
}
