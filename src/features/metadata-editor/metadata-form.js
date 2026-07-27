export function bindCoverControls({ openFile, convertFileSrc, fallbackCoverSrc, showToast }) {
  document.getElementById('edit-metadata-change-cover')?.addEventListener('click', async () => {
    try {
      const selected = await openFile({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
        }],
      });

      if (!selected) return;

      document.getElementById('edit-metadata-cover-path').value = selected;
      document.getElementById('edit-metadata-cover-preview').src = convertFileSrc(selected);
      document.getElementById('edit-metadata-remove-cover').value = 'false';
    } catch (err) {
      console.error('[MetadataEditor] Failed to select cover image:', err);
      showToast('选择图片失败');
    }
  });

  document.getElementById('edit-metadata-delete-cover')?.addEventListener('click', () => {
    document.getElementById('edit-metadata-remove-cover').value = 'true';
    document.getElementById('edit-metadata-cover-path').value = '';
    document.getElementById('edit-metadata-cover-preview').src = fallbackCoverSrc;
  });
}

export function getMetadataFormValues({ getLyricsValue }) {
  const getVal = id => document.getElementById(id)?.value || '';

  return {
    filePath: getVal('edit-metadata-path'),
    title: getVal('edit-metadata-title').trim(),
    artist: getVal('edit-metadata-artist').trim(),
    album: getVal('edit-metadata-album').trim(),
    coverPath: getVal('edit-metadata-cover-path'),
    removeCover: getVal('edit-metadata-remove-cover') === 'true',
    yearVal: getVal('edit-metadata-year'),
    trackVal: getVal('edit-metadata-track'),
    discVal: getVal('edit-metadata-disc'),
    genre: getVal('edit-metadata-genre'),
    albumArtist: getVal('edit-metadata-album-artist'),
    composer: getVal('edit-metadata-composer'),
    lyricist: getVal('edit-metadata-lyricist'),
    comment: getVal('edit-metadata-comment'),
    lyricsVal: getLyricsValue(),
  };
}

export function toWriteMetadataPayload(values) {
  return {
    path: values.filePath,
    title: values.title,
    artist: values.artist || '未知歌手',
    album: values.album || '未知专辑',
    year: values.yearVal ? parseInt(values.yearVal, 10) : null,
    trackNumber: values.trackVal ? parseInt(values.trackVal, 10) : null,
    discNumber: values.discVal ? parseInt(values.discVal, 10) : null,
    genre: values.genre || null,
    albumArtist: values.albumArtist || null,
    composer: values.composer || null,
    lyricist: values.lyricist || null,
    comment: values.comment || null,
    lyrics: values.lyricsVal || null,
    coverImagePath: values.coverPath || null,
    removeCover: values.removeCover,
  };
}

export function setMetadataSaveBusy(isBusy, busyText = '保存中...', idleText = '保存修改') {
  const saveBtn = document.getElementById('metadata-editor-save');
  if (!saveBtn) return null;

  if (isBusy) {
    const originalText = saveBtn.textContent;
    saveBtn.dataset.originalText = originalText;
    saveBtn.textContent = busyText;
    saveBtn.disabled = true;
    return originalText;
  }

  saveBtn.textContent = saveBtn.dataset.originalText || idleText;
  saveBtn.disabled = false;
  delete saveBtn.dataset.originalText;
  return null;
}

export function fillMetadataForm({ meta, filePath, getCoverSrc }) {
  const setVal = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.value = value;
  };

  const setSrc = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.src = value;
  };

  setVal('edit-metadata-path', filePath);
  setSrc('edit-metadata-cover-preview', getCoverSrc(null));
  setVal('edit-metadata-cover-path', '');
  setVal('edit-metadata-remove-cover', 'false');

  setVal('edit-metadata-title', meta?.title || '');
  setVal('edit-metadata-artist', meta?.artist || '');
  setVal('edit-metadata-album', meta?.album || '');
  setVal('edit-metadata-year', meta?.year || '');
  setVal('edit-metadata-track', meta?.track_number || '');
  setVal('edit-metadata-disc', meta?.disc_number || '');
  setVal('edit-metadata-genre', meta?.genre || '');
  setVal('edit-metadata-album-artist', meta?.album_artist || '');
  setVal('edit-metadata-composer', meta?.composer || '');
  setVal('edit-metadata-lyricist', meta?.lyricist || '');
  setVal('edit-metadata-comment', meta?.comment || '');

  if (meta?.cover_image) {
    setSrc('edit-metadata-cover-preview', getCoverSrc(meta.cover_image));
  }
}
