import {
  applyInterfaceFont,
  getFontFileName,
  getStoredInterfaceFont,
  INTERFACE_FONT_PRESETS,
} from '../ui/interface-font.js';
import { checkForUpdates, setBetaKey, getBetaStatus, BETA_KEY, APP_VERSION } from '../ui/update-checker.js';
import { openUrl } from '@tauri-apps/plugin-opener';
import { updateLyricsPreference } from '../lyrics/preferences.js';

export const createSettingsPage = ({
  player,
  showToast,
  applyMiniLyricsTranslationSetting,
  applyTheme,
  applyLyricsTheme,
  applyUiStyle,
  applyBackgroundStyle,
  getCurrentTheme,
  customConfirm,
  clearLyricsDB,
  open,
  invoke,
  setMusicLibrary,
  clearSearchCache,
  resetDiscoverRecommendations,
  backgroundLoadCovers,
  desktopLyrics,
  switchTab,
  reapplyCurrentColor,
}) => {
  const renderSettingsTab = () => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const staggerMode = localStorage.getItem('kimo-lyrics-stagger-mode') || 'word';
    const fsRaw = localStorage.getItem('kimo-lyrics-font-size');
    const fontSize = (fsRaw !== null && !isNaN(parseFloat(fsRaw))) ? parseFloat(fsRaw) : 22.0;
    const liftRaw = localStorage.getItem('kimo-lyrics-lift-amplitude');
    const liftAmp = Math.max(
      0,
      Math.min(5, (liftRaw !== null && !isNaN(parseFloat(liftRaw))) ? parseFloat(liftRaw) : 4.0),
    );
    const lineSpacingRaw = localStorage.getItem('kimo-lyrics-line-spacing');
    const lineSpacing = (lineSpacingRaw !== null && !isNaN(parseFloat(lineSpacingRaw))) ? parseFloat(lineSpacingRaw) : 0.85;
    const rowFollowAnimationVal = localStorage.getItem('kimo-lyrics-row-follow-enabled') !== 'false';
    const miniTransVal = localStorage.getItem('kimo-mini-lyrics-show-translation') === 'true';
    const desktopLyricsEnabled = localStorage.getItem('kimo-desktop-lyrics-enabled') === 'true';
    const desktopLyricsFontSize = Number(localStorage.getItem('kimo-desktop-lyrics-font-size') || 34);
    const desktopLyricsOpacity = Number(localStorage.getItem('kimo-desktop-lyrics-opacity') || 0.96);
    const desktopLyricsShowTranslation = localStorage.getItem('kimo-desktop-lyrics-show-translation') !== 'false';
    const desktopLyricsLocked = localStorage.getItem('kimo-desktop-lyrics-locked') === 'true';
    const desktopLyricsTheme = localStorage.getItem('kimo-desktop-lyrics-theme') || 'aurora';
    const desktopLyricsAlign = localStorage.getItem('kimo-desktop-lyrics-align') || 'center';
    const desktopLyricsWordByWord = localStorage.getItem('kimo-desktop-lyrics-word-by-word') !== 'false';
    const desktopLyricsGlow = localStorage.getItem('kimo-desktop-lyrics-glow') !== 'false';
    const desktopLyricsStroke = localStorage.getItem('kimo-desktop-lyrics-stroke') !== 'false';
    const songPlayMode = localStorage.getItem('kimo-song-play-mode') || 'single';
    const aiServerUrl = localStorage.getItem('kimo-ai-server-url') || 'http://127.0.0.1:8000';
        const showQualityBadgeVal = localStorage.getItem('kimo-show-quality-badge') !== 'false';
    const showBitrateBadgeVal = localStorage.getItem('kimo-show-bitrate-badge') !== 'false';
    const lyricsThemeVal = localStorage.getItem('kimo-lyrics-theme') || 'follow';
    
    let scannedDirs = [];
    try {
      scannedDirs = JSON.parse(localStorage.getItem('kimo-scanned-dirs') || '[]');
    } catch(e) {}

    const container = document.createElement('div');
    container.className = 'settings-container';
    
    const lyricCard = document.createElement('div');
    lyricCard.className = 'settings-card';
    lyricCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        歌词与视觉动效
      </div>
      
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">歌词动画切换模式</div>
          <div class="setting-desc">控制卡拉OK歌词播放时，是以单个字母为单位依次上移，还是以完整单词为单位整体上移。</div>
        </div>
        <div class="setting-radio-group" id="settings-stagger-group" data-active-idx="${staggerMode === 'stagger' ? '0' : '1'}">
          <div class="setting-radio-active-bg"></div>
          <button class="setting-radio-btn ${staggerMode === 'stagger' ? 'active' : ''}" data-val="stagger">字母依次</button>
          <button class="setting-radio-btn ${staggerMode === 'word' ? 'active' : ''}" data-val="word">单词整体</button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">歌词逐行跟随动画</div>
          <div class="setting-desc">开启后，当前歌词切换时，下方歌词会按距离依次跟随上移；关闭后所有歌词同步平滑上移。</div>
        </div>
        <label class="setting-toggle" title="切换歌词逐行跟随动画">
          <input type="checkbox" id="settings-lyrics-row-follow" ${rowFollowAnimationVal ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">歌词默认字号</div>
          <div class="setting-desc">调节全屏歌词面板中的歌词渲染大小。支持无级缩放。</div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-font-size" min="16" max="48" step="0.5" value="${fontSize}">
          <div class="setting-value-display" id="settings-font-size-val">${fontSize.toFixed(1)}px</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">歌词上抬动画幅度</div>
          <div class="setting-desc">调节当前发音的歌词向上漂移抬升的物理高度（以像素为单位）。</div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-lift" min="0" max="5" step="1" value="${liftAmp}">
          <div class="setting-value-display" id="settings-lift-val">${liftAmp}px</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">歌词行间距</div>
          <div class="setting-desc">调节两句歌词之间的上下间距（相对字号倍数，=紧贴）。</div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-line-spacing" min="0" max="2.0" step="0.05" value="${lineSpacing}">
          <div class="setting-value-display" id="settings-line-spacing-val">${lineSpacing.toFixed(2)}</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">迷你歌词显示翻译</div>
          <div class="setting-desc">开启后，主播放页中央的迷你歌词下方会显示当前行的翻译内容。</div>
        </div>
        <label class="setting-toggle" title="切换迷你歌词翻译">
          <input type="checkbox" id="settings-mini-translation" ${miniTransVal ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>
    `;
    container.appendChild(lyricCard);

    // ========== 桌面歌词独立设置卡片 ==========
    const desktopLyricCard = document.createElement('div');
    desktopLyricCard.className = 'settings-card';
    desktopLyricCard.innerHTML = `
      <div class="settings-card-title">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        桌面歌词设置
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">开启桌面歌词</div>
          <div class="setting-desc">在桌面上显示浮动置顶歌词；悬停可进行切歌、调字号与锁定。</div>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="settings-desktop-lyrics" ${desktopLyricsEnabled ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">锁定桌面歌词 (鼠标穿透)</div>
          <div class="setting-desc">锁定后歌词窗口支持鼠标完全穿透，防止误触拖动；可在此解除锁定。</div>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="settings-desktop-lyrics-locked" ${desktopLyricsLocked ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">桌面歌词字号</div>
          <div class="setting-desc">调整桌面歌词文字显示字号大小。</div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-desktop-lyrics-size" min="12" max="56" step="1" value="${desktopLyricsFontSize}">
          <div class="setting-value-display" id="desktop-lyrics-size-val">${desktopLyricsFontSize}px</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">桌面歌词透明度</div>
          <div class="setting-desc">调整桌面歌词窗口的不透明度。</div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-desktop-lyrics-opacity" min="0.25" max="1" step="0.05" value="${desktopLyricsOpacity}">
          <div class="setting-value-display" id="desktop-lyrics-opacity-val">${Math.round(desktopLyricsOpacity * 100)}%</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">桌面歌词逐字动画</div>
          <div class="setting-desc">开启后若歌词包含逐字时间戳，桌面歌词将展示平滑的逐字高亮/卡拉OK效果。</div>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="settings-desktop-lyrics-word-by-word" ${desktopLyricsWordByWord ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">显示歌词翻译</div>
          <div class="setting-desc">在桌面歌词下方显示对应的翻译字幕。</div>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="settings-desktop-lyrics-translation" ${desktopLyricsShowTranslation ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">字体阴影</div>
          <div class="setting-desc">为桌面歌词文字提供霓虹发光与背景阴影以增强质感（关闭后文字变纯净）。</div>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="settings-desktop-lyrics-glow" ${desktopLyricsGlow ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">字体描边</div>
          <div class="setting-desc">在发光关闭时提供微弱黑投影以在白壁纸下防瞎（关闭后展现极致纯净裸字）。</div>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" id="settings-desktop-lyrics-stroke" ${desktopLyricsStroke ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">配色Preset与对齐</div>
          <div class="setting-desc">选择流光发光主题Preset与文字对齐方式。</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="settings-desktop-lyrics-theme" class="setting-select">
            <option value="follow-app" ${desktopLyricsTheme === 'follow-app' ? 'selected' : ''}>跟随软件主题 (Auto)</option>
            <option value="aurora" ${desktopLyricsTheme === 'aurora' ? 'selected' : ''}>极光青绿 (Aurora)</option>
            <option value="cyber" ${desktopLyricsTheme === 'cyber' ? 'selected' : ''}>赛博粉紫 (Cyber)</option>
            <option value="sunset" ${desktopLyricsTheme === 'sunset' ? 'selected' : ''}>夕阳金橙 (Sunset)</option>
            <option value="ocean" ${desktopLyricsTheme === 'ocean' ? 'selected' : ''}>蔚蓝深海 (Ocean)</option>
            <option value="white" ${desktopLyricsTheme === 'white' ? 'selected' : ''}>经典亮白 (White)</option>
          </select>
          <select id="settings-desktop-lyrics-align" class="setting-select">
            <option value="center" ${desktopLyricsAlign === 'center' ? 'selected' : ''}>居中对齐</option>
            <option value="left" ${desktopLyricsAlign === 'left' ? 'selected' : ''}>靠左对齐</option>
            <option value="right" ${desktopLyricsAlign === 'right' ? 'selected' : ''}>靠右对齐</option>
          </select>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">沉浸模式隐藏标题栏</div>
          <div class="setting-desc">进入沉浸全屏模式时，是否隐藏窗口标题栏按钮（最小化、最大化、关闭）。</div>
        </div>
        <label class="setting-toggle" title="切换沉浸模式隐藏标题栏">
          <input type="checkbox" id="settings-immersive-hide-titlebar" ${localStorage.getItem('kimo-immersive-hide-titlebar') === 'false' ? '' : 'checked'} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>
    `;
    container.appendChild(desktopLyricCard);

    const perfCard = document.createElement('div');
    perfCard.className = 'settings-card';
    const isPerfMode = localStorage.getItem('kimo-performance-mode') === 'true';
    perfCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        硬件性能与省电模式
      </div>
      
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">开启低功耗性能模式</div>
          <div class="setting-desc">适合在集成显卡、低功耗设备或播放不够流畅时尝试开启。开启后会减少景深模糊和毛玻璃效果，可能降低 CPU 与 GPU 占用并改善歌词动画流畅度，实际效果因设备而异。</div>
        </div>
        <label class="setting-toggle" title="切换低功耗性能模式">
          <input type="checkbox" id="settings-perf-mode" ${isPerfMode ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>
    `;
    container.appendChild(perfCard);

    const themeCard = document.createElement('div');
    themeCard.className = 'settings-card';
    const themeVal = localStorage.getItem('kimo-theme') || 'light';
    const uiStyleVal = localStorage.getItem('kimo-ui-style') || 'solid';
    const bgStyleVal = localStorage.getItem('kimo-bg-style') || 'static';
    const bgRotatePct = parseFloat(localStorage.getItem('kimo-bg-rotate-speed')) || 50;
    const isCustom = localStorage.getItem('kimo-overlay-opacity-custom') === 'true';
    const savedOpVal = isCustom ? localStorage.getItem('kimo-overlay-opacity') : null;
    const opacityNum = savedOpVal !== null ? Math.round(parseFloat(savedOpVal) * 100) : (themeVal === 'light' ? 72 : (themeVal === 'grey' ? 65 : 62));

    const zoomRaw = localStorage.getItem('kimo-ui-scale');
    const currentZoom = (zoomRaw !== null && !isNaN(parseFloat(zoomRaw))) ? parseFloat(zoomRaw) : 1.0;
    const zoomPercent = Math.round(currentZoom * 100);

    const radiusRaw = localStorage.getItem('kimo-window-radius');
    const currentRadius = (radiusRaw !== null && !isNaN(parseFloat(radiusRaw))) ? parseInt(radiusRaw, 10) : 5;
    const interfaceFont = getStoredInterfaceFont();
    const interfaceFontOptions = INTERFACE_FONT_PRESETS.map(preset =>
      `<option value="${preset.value}" ${interfaceFont.mode === preset.value ? 'selected' : ''}>${preset.label}</option>`
    ).join('');

    // 取色设置
    const colorEnabled = localStorage.getItem('kimo-color-extraction') !== 'off';
    const colorMode = localStorage.getItem('kimo-color-mode') || 'smart';
    const colorIntensity = parseInt(localStorage.getItem('kimo-color-intensity'), 10) || 0;

    themeCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 1 0 10 10"/></svg>
        外观主题与遮罩设置
      </div>
      
            <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">默认外观主题</div>
          <div class="setting-desc">设置播放器的外观主题（支持浅色遮罩、雅致灰色与深色遮罩主题）。</div>
        </div>
        <div class="setting-radio-group" id="settings-theme-group" data-active-idx="${themeVal === 'light' ? '0' : (themeVal === 'grey' ? '1' : '2')}">
          <div class="setting-radio-active-bg"></div>
          <button class="setting-radio-btn ${themeVal === 'light' ? 'active' : ''}" data-val="light">浅色遮罩</button>
          <button class="setting-radio-btn ${themeVal === 'grey' ? 'active' : ''}" data-val="grey">雅致灰色</button>
          <button class="setting-radio-btn ${themeVal === 'dark' ? 'active' : ''}" data-val="dark">深色遮罩</button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">UI 风格</div>
          <div class="setting-desc">选择界面玻璃材质效果，从默认纯色到液态玻璃逐级增强视觉质感。默认效果性能最佳。</div>
        </div>
        <div class="setting-radio-group" id="settings-ui-style-group" data-active-idx="${uiStyleVal === 'solid' ? '0' : (uiStyleVal === 'acrylic' ? '1' : (uiStyleVal === 'gaussian' ? '2' : '3'))}">
          <div class="setting-radio-active-bg"></div>
          <button class="setting-radio-btn ${uiStyleVal === 'solid' ? 'active' : ''}" data-val="solid">默认效果</button>
          <button class="setting-radio-btn ${uiStyleVal === 'acrylic' ? 'active' : ''}" data-val="acrylic">亚克力</button>
          <button class="setting-radio-btn ${uiStyleVal === 'gaussian' ? 'active' : ''}" data-val="gaussian">高斯模糊</button>
          <button class="setting-radio-btn ${uiStyleVal === 'liquid' ? 'active' : ''}" data-val="liquid">液态玻璃</button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">背景样式</div>
          <div class="setting-desc">选择播放器背景的展示方式。动态背景会将专辑封面扭曲后围绕窗口中心旋转，营造沉浸式视觉体验。</div>
        </div>
        <div class="setting-radio-group" id="settings-bg-style-group" data-active-idx="${bgStyleVal === 'none' ? '0' : (bgStyleVal === 'static' ? '1' : '2')}">
          <div class="setting-radio-active-bg"></div>
          <button class="setting-radio-btn ${bgStyleVal === 'none' ? 'active' : ''}" data-val="none">去除背景</button>
          <button class="setting-radio-btn ${bgStyleVal === 'static' ? 'active' : ''}" data-val="static">静态背景</button>
          <button class="setting-radio-btn ${bgStyleVal === 'dynamic' ? 'active' : ''}" data-val="dynamic">动态背景</button>
        </div>
      </div>

      <div class="setting-row" id="settings-bg-rotate-speed-row" style="display: ${bgStyleVal === 'dynamic' ? 'flex' : 'none'};">
        <div class="setting-info">
          <div class="setting-label">动态背景旋转速率</div>
          <div class="setting-desc">调整专辑封面背景的旋转速度，百分比越高旋转越快。拖动时暂停旋转，释放后生效。</div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-bg-rotate-speed" min="10" max="100" step="5" value="${bgRotatePct}">
          <div class="setting-value-display" id="settings-bg-rotate-speed-val">${bgRotatePct}%</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">歌词页面主题</div>
          <div class="setting-desc">单独设置歌词页面的外观主题，可选择自动跟随或独立设置深色/浅色。</div>
        </div>
        <div class="setting-radio-group" id="settings-lyrics-theme-group" data-active-idx="${lyricsThemeVal === 'follow' ? '0' : (lyricsThemeVal === 'light' ? '1' : '2')}">
          <div class="setting-radio-active-bg"></div>
          <button class="setting-radio-btn ${lyricsThemeVal === 'follow' ? 'active' : ''}" data-val="follow">自动</button>
          <button class="setting-radio-btn ${lyricsThemeVal === 'light' ? 'active' : ''}" data-val="light">浅色</button>
          <button class="setting-radio-btn ${lyricsThemeVal === 'dark' ? 'active' : ''}" data-val="dark">深色</button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">界面字体</div>
          <div class="setting-desc">切换播放器界面使用的字体，或选择本地 TTF、OTF、WOFF 字体文件。歌词字号与字重设置不受影响。</div>
        </div>
        <div class="setting-font-controls">
          <select class="setting-select" id="settings-interface-font">
            ${interfaceFontOptions}
            <option value="custom" ${interfaceFont.mode === 'custom' ? 'selected' : ''}>自定义字体</option>
          </select>
          <button class="setting-btn" id="settings-custom-font-btn">选择字体文件</button>
          <div class="setting-font-file" id="settings-custom-font-file" title="${interfaceFont.customPath}">${getFontFileName(interfaceFont.customPath)}</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">背景遮罩透明度</div>
          <div class="setting-desc">无级微调背景高斯模糊遮罩层的不透明度。</div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-opacity" min="0" max="100" step="1" value="${opacityNum}">
          <div class="setting-value-display" id="settings-opacity-val">${opacityNum}%</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">专辑封面取色</div>
          <div class="setting-desc">从专辑封面提取主题色并应用到播放器界面。关闭后使用默认蓝色主题。</div>
        </div>
        <label class="setting-toggle" title="切换专辑封面取色">
          <input type="checkbox" id="settings-color-extraction-toggle" ${colorEnabled ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div class="setting-row" id="settings-color-mode-row" style="display: ${colorEnabled ? 'flex' : 'none'};">
        <div class="setting-info">
          <div class="setting-label">取色模式</div>
          <div class="setting-desc">智能模式根据当前主题自动适配最佳亮度，保证可读性。手动模式可自由调节取色深浅。</div>
        </div>
        <div class="setting-radio-group" id="settings-color-mode-group" data-active-idx="${colorMode === 'smart' ? '0' : '1'}">
          <div class="setting-radio-active-bg"></div>
          <button class="setting-radio-btn ${colorMode === 'smart' ? 'active' : ''}" data-val="smart">智能取色</button>
          <button class="setting-radio-btn ${colorMode === 'manual' ? 'active' : ''}" data-val="manual">手动调节</button>
        </div>
      </div>

      <div class="setting-row" id="settings-color-intensity-row" style="display: ${colorEnabled && colorMode === 'manual' ? 'flex' : 'none'};">
        <div class="setting-info">
          <div class="setting-label">取色深浅</div>
          <div class="setting-desc">向左偏深，向右偏浅。中间为平衡值。</div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-color-intensity" min="-50" max="50" step="1" value="${colorIntensity}">
          <div class="setting-value-display" id="settings-color-intensity-val">${colorIntensity > 0 ? '+' : ''}${colorIntensity}</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">软件界面缩放比例</div>
          <div class="setting-desc">无级微调整个播放器软件组件的缩放大小，以完美适配不同的高分屏或低分辨率屏幕。</div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-zoom" min="80" max="120" step="1" value="${zoomPercent}">
          <div class="setting-value-display" id="settings-zoom-val">${zoomPercent}%</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">显示音质标签 (SQ / Hi-Res / HQ)</div>
          <div class="setting-desc">控制歌曲列表中是否展示音质等级徽章（如玫瑰红 SQ、黑金 Hi-Res、紫罗兰 HQ 等）。</div>
        </div>
        <label class="setting-toggle" title="切换音质标签展示">
          <input type="checkbox" id="settings-show-quality-badge" ${showQualityBadgeVal ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">显示码率标签 (1291k / 320k)</div>
          <div class="setting-desc">控制歌曲列表中是否展示具体的音频传输码率数字标签。</div>
        </div>
        <label class="setting-toggle" title="切换码率标签展示">
          <input type="checkbox" id="settings-show-bitrate-badge" ${showBitrateBadgeVal ? 'checked' : ''} />
          <span class="setting-toggle-track" aria-hidden="true"></span>
        </label>
      </div>
    `;
    container.appendChild(themeCard);

    const aiCard = document.createElement('div');
    aiCard.className = 'settings-card';
    aiCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        AI 语音识别服务 (ASR)
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">推理服务器地址 (Server URL)</div>
          <div class="setting-desc">用于提取未配对歌词音频的 Whisper 时间戳对齐服务后台接口。</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <input type="text" class="setting-input" id="settings-asr-url" value="${aiServerUrl}">
          <button class="setting-btn accent" id="settings-save-asr-btn">保存</button>
        </div>
      </div>
    `;
    container.appendChild(aiCard);

    const playbackCard = document.createElement('div');
    playbackCard.className = 'settings-card';
    const autoPlayVal = localStorage.getItem('kimo-auto-play-on-start') === 'true';
    playbackCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        播放与启动设置
      </div>
      
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">启动自动播放</div>
          <div class="setting-desc">打开软件时，自动播放上次关闭前播放的歌曲。</div>
        </div>
        <div style="display: flex; align-items: center;">
          <input type="checkbox" id="settings-autoplay-on-start" ${autoPlayVal ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: rgb(var(--dynamic-color, 16, 185, 129));" />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">列表播放方式</div>
          <div class="setting-desc">选择歌曲列表中触发播放所需的点击次数。</div>
        </div>
        <div class="setting-radio-group" id="settings-song-play-mode" data-active-idx="${songPlayMode === 'double' ? '1' : '0'}">
          <div class="setting-radio-active-bg"></div>
          <button class="setting-radio-btn ${songPlayMode === 'single' ? 'active' : ''}" data-val="single">单击播放</button>
          <button class="setting-radio-btn ${songPlayMode === 'double' ? 'active' : ''}" data-val="double">双击播放</button>
        </div>
      </div>
    `;
    container.appendChild(playbackCard);

    playbackCard.querySelector('#settings-autoplay-on-start').addEventListener('change', (e) => {
      localStorage.setItem('kimo-auto-play-on-start', e.target.checked);
      showToast(`已${e.target.checked ? '开启' : '关闭'}启动自动播放`);
    });

    playbackCard.querySelectorAll('#settings-song-play-mode .setting-radio-btn').forEach((button, index) => {
      button.addEventListener('click', () => {
        playbackCard.querySelectorAll('#settings-song-play-mode .setting-radio-btn').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        playbackCard.querySelector('#settings-song-play-mode').setAttribute('data-active-idx', String(index));
        const mode = button.dataset.val;
        localStorage.setItem('kimo-song-play-mode', mode);
        showToast(`已切换为${mode === 'double' ? '双击播放' : '单击播放'}`);
      });
    });

    const scanCard = document.createElement('div');
    scanCard.className = 'settings-card';
    scanCard.id = 'settings-scan-card';
    
    let pathsHtml = '';
    if (scannedDirs.length === 0) {
      pathsHtml = `<div class="scanned-paths-empty">暂无已添加的扫描文件夹目录，请点击下方按钮添加。</div>`;
    } else {
      pathsHtml = `<div class="scanned-paths-list">`;
      scannedDirs.forEach((dir, index) => {
        pathsHtml += `
          <div class="scanned-path-item">
            <div class="scanned-path-text" title="${dir}">${dir}</div>
            <button class="scanned-path-remove" data-idx="${index}" title="移出列表">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        `;
      });
      pathsHtml += `</div>`;
    }

    scanCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        音乐文件夹扫描管理
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${pathsHtml}
        <div class="settings-actions">
          <button class="setting-btn" id="settings-clear-dirs">清空歌曲缓存</button>
          <button class="setting-btn" id="settings-add-dir-btn">添加文件夹</button>
          <button class="setting-btn accent" id="settings-scan-btn">立即重新扫描</button>
        </div>
      </div>
    `;
    container.appendChild(scanCard);

    // 关于软件 Card
    const aboutCard = document.createElement('div');
    aboutCard.className = 'settings-card';
    aboutCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        关于软件
      </div>
      
      <div class="setting-row" style="flex-direction: column; align-items: flex-start; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
          <div class="about-logo" style="width: 48px; height: 48px; border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            <img src="/logo.png" alt="KimoPlayer" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
          </div>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size: 18px; font-weight: 700; color: var(--text-primary); letter-spacing: 0.5px;">KimoPlayer</span>
              <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;background:rgba(16,185,129,0.12);color:rgb(16,185,129);border:1px solid rgba(16,185,129,0.2);">开源</span>
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">版本: ${APP_VERSION}</div>
          </div>
          <div id="settings-github-link" style="cursor:pointer;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);transition:all 0.2s;" title="GitHub 仓库">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="color:var(--text-secondary);"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </div>
        </div>
        
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; font-family: var(--font-family);">
          KimoPlayer 是一款轻量、精美的本地音频播放器。支持卡拉OK逐词歌词同步与编辑制作、歌词离线检索匹配、流畅的歌词滚动对齐以及极简的毛玻璃动态背景，为您带来纯净、舒适的本地音乐播放体验。
        </div>
        
                <div style="width: 100%; height: 1px; background: var(--glass-border); margin: 8px 0;"></div>

        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: var(--text-tertiary); width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>核心技术</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="tech-badge" title="Tauri" style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.06);font-size:11px;color:var(--text-secondary);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="#ffc131"/><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" fill="#ffc131" opacity="0.3"/></svg>
                Tauri
              </span>
              <span class="tech-badge" title="Rust" style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.06);font-size:11px;color:var(--text-secondary);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M3 3h9v9H3V3zm9 9h9v9h-9v-9zm-9 0h9v9H3v-9z" fill="#dea584" opacity="0.8"/></svg>
                Rust
              </span>
              <span class="tech-badge" title="Vite" style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.06);font-size:11px;color:var(--text-secondary);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21.805 5.27L12.616 21.272l-2.048-6.496L3.195 5.27h18.61zM12.616 16.728l4.304-11.458H5.08l7.536 11.458z" fill="#646cff"/></svg>
                Vite
              </span>
              <span class="tech-badge" title="Vanilla JS" style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.06);font-size:11px;color:var(--text-secondary);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="3" fill="#f7df1e"/><text x="12" y="17" text-anchor="middle" font-size="12" font-weight="bold" fill="#323330">JS</text></svg>
                JS
              </span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>开源仓库</span>
            <span style="color: var(--text-secondary);cursor:pointer;" id="settings-github-text">github.com/kiomosu/KimoPlayer</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>版权所有</span>
            <span style="color: var(--text-secondary);">© 2026 KimoPlayer. 保留所有权。</span>
          </div>
        </div>

        <div style="width: 100%; height: 1px; background: var(--glass-border); margin: 8px 0;"></div>

        <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
          <div id="settings-changelog-btn" class="setting-row" style="cursor: pointer; margin: 0; padding: 10px 14px; border-radius: 10px; transition: background 0.2s;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span style="font-size: 13px; color: var(--text-primary);">查看历史更新</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>

          <div style="display:flex;gap:8px;padding:4px 14px 2px;">
            <button id="settings-check-update-btn" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 12px;font-size:12px;font-weight:600;border:1px solid var(--glass-border);border-radius:10px;background:rgba(255,255,255,0.03);color:var(--text-primary);cursor:pointer;white-space:nowrap;transition:all 0.2s;">
              <svg id="check-update-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span id="check-update-text">检查更新</span>
            </button>
            <button id="settings-beta-btn" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 12px;font-size:12px;font-weight:600;border:1px solid var(--glass-border);border-radius:10px;${getBetaStatus() ? 'background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.3);color:rgb(16,185,129);' : 'background:rgba(255,255,255,0.03);color:var(--text-primary);'}cursor:pointer;white-space:nowrap;transition:all 0.2s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              <span>${getBetaStatus() ? '已加入测试' : '加入测试'}</span>
            </button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(aboutCard);

        // 历史更新公告数据
        const changelogData = [
      {
        version: '1.6.0',
        date: '2026.07.30',
        type: '歌词引擎与编辑器升级',
        sections: [
          { title: '歌词解析全面升级', items: ['逐字 LRC 与 TTML 统一为明确的行、单元 begin/end 时间模型，相邻单元无缝共用时间边界', '修复英文空格、单字母、末尾单词瞬间染色、首行跳动与编辑预览不一致问题', '完善翻译、行结束时间以及 TTML xr-BG 背景人声解析'] },
          { title: '共唱、背景人声与动效', items: ['真正重叠的歌词支持同时演唱，首尾仅接触的两行不再误判为共唱', '背景人声在主句下方独立展开并原位收起，优化字号、翻译比例与消失动画', '修复共唱滚动抽搐、背景行错位与模糊更新延迟', '新增轻微放大效果，缩放还原与上移同步；快速歌词自动缩短行切换动画'] },
          { title: '元数据与歌词编辑器', items: ['重构歌曲信息与歌词编辑窗口，适配新布局、主题和 UI 材质', '完整展示逐字歌词、翻译、声道、背景人声及时间边界', '优化卡片层级、按钮位置、颜色区分、字号与滚动区域'] },
          { title: '界面与交互', items: ['歌词工具栏滑块浮层全区域支持滚轮操作', '歌词抬起幅度上限统一为 5px', '封面播放/暂停按钮出现首帧即呈现背景模糊', '播放列表、侧边栏选中滑块与三枚页面悬浮按钮完整适配四套 UI 材质'] },
          { title: '应用内更新修复', items: ['静默安装完成后自动重新打开新版', '新版启动时显式刷新主窗口图标，修复任务栏保留旧图标的问题'] },
        ],
      },
      {
        version: '1.5.2',
        date: '2026.07.30',
        type: '取色与界面优化',
        sections: [
          { title: '专辑封面取色设置', items: ['新增取色开关，可一键开启或关闭专辑封面取色功能，关闭后使用默认蓝色主题', '新增智能取色模式，根据当前主题（深色/浅色/灰色）自动适配最佳亮度，保证可读性', '新增手动调节模式，可自由调整取色深浅（-50 偏深 ~ +50 偏浅），拖动滑块实时预览'] },
          { title: '歌词面板修复', items: ['修复歌词面板无法进入的问题，清除内联 transform 样式让 CSS active 类正常生效', '歌词面板与控制栏弹出框不受 UI 缩放比例影响，始终保持原始尺寸'] },
          { title: '启动画面与图标优化', items: ['移除启动画面 logo 的阴影效果，呈现更简洁的视觉风格', '移除关于页面 logo 的阴影效果', 'GitHub 仓库主页 README 新增 KimoPlayer logo 图标展示'] },
        ],
      },
      {
        version: '1.5.1',
        date: '2026.07.29',
        type: '功能与体验优化',
        sections: [
          { title: '系统文件关联', items: ['安装后可在操作系统中双击音频文件直接使用播放器打开播放，支持 mp3、flac、wav、ogg、m4a、aac、wma、opus、ape、aiff 共 10 种格式', '应用已运行时双击文件自动追加到播放列表并播放，应用未运行时启动后自动加载'] },
          { title: '背景样式设置', items: ['新增三种背景模式：去除背景、静态背景、动态背景', '动态背景模式下专辑封面以模糊旋转效果展示，可在设置中调节旋转速率（10%~100%）', '拖动滑块时暂停旋转，释放后立即生效'] },
          { title: 'UI 风格体系完善', items: ['新增四种 UI 风格：默认效果、亚克力、高斯模糊、液态玻璃，按视觉复杂度递增排列', '亚克力模式主内容区 60% 透明度 + 设置卡片 70% 透明度，呈现微妙层次感', '液态玻璃模式使用评论区同款材质参数，保留侧边栏与播放栏液态边框', '评论区窗口、右键菜单、Toast 提示全面适配四种 UI 风格', '深色主题下亚克力模式使用半透明黑色，浅色/灰色主题使用半透明白色'] },
          { title: '歌词弹出框重新设计', items: ['歌词控制栏滑块弹出框改为现代玻璃胶囊风格，增大模糊半径与饱和度', '滑块轨道新增进度填充效果，已调节部分以动态主题色高亮显示', '弹出框跟随歌词页面主题设置（深色/浅色/跟随软件），与右键菜单机制统一', '增大滑块圆点尺寸，优化悬停与拖动时的缩放反馈'] },
          { title: '滑块交互优化', items: ['所有设置页滑块与歌词弹出框滑块统一支持鼠标滚轮调整', '修复弹出框字号上限（36→48px）与抬起幅度上限（15→40px）未跟随设置页同步的问题', '动态背景旋转速率滑块滚轮调整后立即生效并恢复旋转'] },
          { title: '应用内更新功能', items: ['新增应用内更新检查器，自动从 GitHub Releases 获取最新版本', '支持优先选择 NSIS 安装包而非便携版', '测试版用户可输入密钥访问预发布版本', '更新下载进度实时显示，下载完成后一键安装'] },
        ],
      },
      {
        version: '1.5.0',
        date: '2026.07.28',
        type: '开源版本',
        sections: [
          { title: '开源发布', items: ['KiomPlayer 正式开源，源代码托管于 GitHub', '基于 Tauri + Rust + Vite 技术栈构建'] },
        ],
      },
      {
        version: '1.4.6-beta01',
        date: '2026.07.26',
        type: '右键菜单重构',
        sections: [
          { title: '右键菜单玻璃材质统一', items: ['所有右键菜单改为和评论区一致的玻璃材质（blur + 半透明背景）', '支持深色/浅色/灰色三套主题自动适配', '歌词界面右键菜单跟随歌词深浅色主题而非软件全局主题'] },
          { title: '歌词面板控制按钮', items: ['标题栏按钮、歌词控件按钮统一为玻璃材质', '歌词面板弹出框移到 body 下避免被 overflow: hidden 裁剪', '移除歌词面板内控制按钮的原生 tooltip（避免裁断）'] },
          { title: '右键菜单精简', items: ['移除空白区域默认右键菜单（含关闭播放器等）', '封面右键菜单仅在歌词页大封面触发', '播放器信息栏区域不再触发右键菜单'] },
          { title: '其他优化', items: ['评论搜索综合歌名+艺术家+专辑三维度匹配', '评论回复支持分页加载与展开/收起动画', '切歌时收藏按钮状态自动更新'] },
        ],
      },
      {
        version: '1.4.5',
        date: '2026.07.26',
        type: '优化与修复更新',
        sections: [
          { title: '评论搜索优化', items: ['改进评论搜索匹配算法，综合歌名、艺术家、专辑三维度匹配', '修复评论搜索匹配到错误歌曲的问题', '搜索结果同分时优先选专辑名短的（原版特征）'] },
          { title: '评论回复改进', items: ['网易云评论回复支持分页加载', '回复列表支持展开/收起动画', '回复按钮统一为纯文字样式'] },
          { title: '界面优化', items: ['禁用默认右键菜单，仅保留自定义菜单', '歌词界面艺术家跑马灯修复', '切歌时收藏按钮状态自动更新'] },
        ],
      },
      {
        version: '1.4.4',
        date: '2026.07.26',
        type: '功能与修复更新',
        sections: [
          { title: '系统托盘增强', items: ['关闭窗口最小化到托盘，双击托盘恢复窗口', '托盘菜单支持播放控制（上一首/播放暂停/下一首）', '托盘显示当前歌曲信息与播放状态', '托盘快速开关桌面歌词和打开设置'] },
          { title: '评论区大幅优化', items: ['切歌自动刷新评论面板', '支持加载更多评论与滚动自动加载', '新增评论回复查看（网易云）', '回复按点赞数排序，支持分页加载', '评论与回复显示 IP 属地（网易云）', '热门模式仅显示热评，最新模式过滤热评', '平台切换与排序切换自动滚回顶部'] },
          { title: '歌词界面优化', items: ['艺术家名称支持跑马灯自动滚动', '沉浸模式标题栏收起/展开添加过渡动画', '新增设置项：沉浸模式是否隐藏标题栏'] },
          { title: '其他修复', items: ['修复 QQ 音乐评论总数显示不正确', '修复评论按钮点击无法收起面板', '修复各平台评论回复总数计算错误', '优化设置页字体粗细层次'] },
        ],
      },
      {
        version: '1.4.3',
        date: '2026.07.25',
        type: '功能与优化更新',
        sections: [
          { title: '界面动画升级', items: ['页面切换、详情页进出、标签栏切换都加上了流畅的上浮渐现动画', '动画使用硬件加速，操作更丝滑'] },
          { title: '歌词页面主题设置', items: ['设置里新增歌词页面主题选项：深色 / 浅色 / 跟随软件'] },
          { title: '主页重新设计', items: ['增加月度听歌统计', '可看到最喜欢听的歌排行榜', '显示播放次数和播放时长'] },
          { title: '评论区背景效果优化', items: ['优化评论区背景效果，视觉体验更佳'] },
        ],
      },
      {
        version: '1.4.2',
        date: '2026.07.25',
        type: '功能与修复更新',
        sections: [
          { title: '音频质量标签', items: ['播放列表中的歌曲现在会显示音频质量标签（如 MP3、SQ、Hi-Res 等），方便快速识别音质', '可在设置中选择开启或关闭质量标签显示'] },
          { title: '播放器与格式兼容', items: ['修复 M4A (AAC) 等格式播放时进度条不动与无法拖拽跳转的问题', '优化音频时长获取机制，实现音轨精准播放同步'] },
          { title: '关于页面与弹窗体验', items: ['关于页面新增 Tauri、Rust、Vite、JS 框架小图标，直观展示技术栈', '新增「查看历史更新记录」模态框，并优化全软件弹窗关闭响应与平滑退场动画'] },
        ],
      },
      {
        version: '1.4.1',
        date: '2026.07.25',
        type: '优化更新',
        sections: [
          { title: '评论区优化', items: ['优化评论加载速度，体验更流畅', '优化评论获取逻辑，精准度更高', '优化评论区部分 UI 以及动效表现', '回复功能目前为测试状态，数据并非真实回复'] },
          { title: '主页面优化', items: ['优化主页面切换动效，切换更丝滑'] },
        ],
      },
      {
        version: '1.4.0',
        date: '2026.07.23',
        type: '新功能更新',
        sections: [
          { title: '多平台评论聚合', items: ['支持四大音乐平台评论：网易云音乐、QQ音乐、酷我音乐、酷狗音乐', '聚合展示：在评论面板中可同时查看不同平台的评论内容'] },
        ],
      },
      {
        version: '1.3.0',
        date: '2026.07.23',
        type: '正式版更新',
        sections: [
          { title: '歌词体验', items: ['歌词动效与逐字进度优化，迷你歌词切句同步更准确', '新增桌面歌词：支持透明显示、样式调整与鼠标穿透锁定'] },
          { title: '歌单与本地音乐', items: ['歌单添加支持多首歌曲；长按歌曲进入多选，单击即可选择或取消选择', '补全列表添加时的封面信息，并支持单击或双击播放设置'] },
          { title: '界面与个性化', items: ['新增界面字体选择与自定义字体导入，完善设置项动画与强调色统一', '本地音乐与搜索页优化为独立工具栏和列表滚动，主题配色同步统一'] },
          { title: '编辑与稳定性', items: ['新增独立元数据与歌词编辑窗口，并修复窗口控制、文件路径与保存状态问题', '优化音量控制布局与播放界面响应'] },
        ],
      },
      {
        version: '1.3.0-beta0722-03',
        date: '2026.07.22',
        type: '性能优化',
        sections: [
          { title: '性能与流畅度大幅提升', items: ['播放轻盈省电：优化后台渲染机制，主界面播放音乐时系统资源占用降低 90% 以上', '低功耗性能模式：在【系统设置 -> 歌词与视觉动效】中新增省电/性能模式，推荐集成显卡及笔记本用户开启', '歌词滚动更平滑：优化歌词渲染引擎，歌词滚动与字符动效更加自然丝滑'] },
          { title: '启动与视觉体验优化', items: ['无缝平滑启动：优化软件打开时的窗口呈现，告别界面启动边框与白色闪烁', '软件秒开无卡顿：优化资源后台加载顺序，软件打开响应更快、更轻便'] },
        ],
      },
      {
        version: '1.2.5',
        date: '2026.07.18',
        type: '功能更新',
        sections: [
          { title: '本次更新', items: ['迷你歌词新增逐字卡拉OK扫光效果，与全屏歌词同步', '迷你歌词支持显示翻译（可在设置面板开关）', '迷你歌词换行淡入淡出动画', '歌词面板工具栏自动折叠，点击齿轮图标展开所有设置', '启动时只允许运行单个实例，重复点击自动聚焦已有窗口', '修复音量条悬浮动画卡顿，过渡更流畅平滑', '优化窗口最小尺寸限制（820×560）'] },
        ],
      },
      {
        version: '1.2.0',
        date: '2026.07.10',
        type: '重大更新',
        sections: [
          { title: '侧边栏搜索', items: ['检索功能移至侧边栏，支持分类过滤，检索在后台 Web Worker 中执行以规避卡顿'] },
          { title: '动态模糊背景', items: ['背景替换为封面高斯模糊，支持 32s 缓慢旋转漂移，切歌时双图层 1.6s 渐变过渡'] },
          { title: '共唱歌词对齐', items: ['合唱等交叠歌词支持视口自动居中，优化滚动物理对冲，消除连续跳句时的抽搐抖动'] },
          { title: '底部栏逐字同步', items: ['底部歌词支持逐字染色，超长歌词取消省略号截断并支持自动折行'] },
          { title: 'TTML 解析与编辑', items: ['改用原生 DOMParser 解析以支持嵌套人声，时间轴编辑器支持 TTML 导入与保存'] },
          { title: '右键快捷菜单', items: ['封面支持右键查看/保存大图、修改元数据；歌词行支持右键定位跳转播放、复制文本'] },
          { title: '关于软件', items: ['设置页新增"关于软件"卡片，展示软件当前版本号及系统说明'] },
        ],
      },
    ];

    // 渲染历史更新弹窗
    const showChangelogModal = () => {
      const existing = document.getElementById('kimo-changelog-modal');
      if (existing) existing.remove();

      const itemsHTML = changelogData.map(release => {
        const sectionsHTML = release.sections.map(sec => {
          const listHTML = sec.items.map(it => `<div style="color:var(--text-secondary);font-size:12px;line-height:1.7;">• ${it}</div>`).join('');
          return `<div style="margin-bottom:10px;"><div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:2px;">${sec.title}</div>${listHTML}</div>`;
        }).join('');
        return `
          <div style="padding:14px 0;border-bottom:1px solid var(--glass-border);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="font-size:14px;font-weight:700;color:var(--text-primary);">v${release.version}</span>
              <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.15);color:rgb(16,185,129);">${release.type}</span>
              <span style="font-size:11px;color:var(--text-tertiary);margin-left:auto;">${release.date}</span>
            </div>
            ${sectionsHTML}
          </div>
        `;
      }).join('');

      const overlay = document.createElement('div');
      overlay.id = 'kimo-changelog-modal';
      overlay.className = 'kimo-modal-overlay';
      overlay.innerHTML = `
        <div class="kimo-modal-card" style="max-width:480px;width:92%;max-height:70vh;padding:0;text-align:left;overflow:hidden;display:flex;flex-direction:column;">
          <div style="padding:18px 20px 14px;border-bottom:1px solid var(--glass-border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
            <div style="font-size:16px;font-weight:700;color:var(--text-primary);">历史更新记录</div>
            <button id="kimo-changelog-close" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;padding:4px;display:flex;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style="padding:4px 20px 18px;overflow-y:auto;flex:1;">
            ${itemsHTML}
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const closeModal = () => {
        overlay.classList.add('is-closing');
        setTimeout(() => overlay.remove(), 200);
      };

      overlay.addEventListener('click', e => {
        if (e.target === overlay || e.target.closest('#kimo-changelog-close')) closeModal();
      });
    };

    // 绑定点击事件
    aboutCard.querySelector('#settings-changelog-btn').addEventListener('click', showChangelogModal);

    // GitHub 仓库链接
    const openGithub = () => {
      openUrl('https://github.com/kiomosu/KimoPlayer').catch(() => {
        window.open('https://github.com/kiomosu/KimoPlayer', '_blank');
      });
    };
    aboutCard.querySelector('#settings-github-link')?.addEventListener('click', openGithub);
    aboutCard.querySelector('#settings-github-text')?.addEventListener('click', openGithub);

    // 测试版密钥弹窗
    const showBetaKeyModal = (card) => {
      // 移除已有弹窗
      const existing = document.getElementById('kimo-beta-key-modal');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'kimo-beta-key-modal';
      overlay.className = 'kimo-modal-overlay';
      overlay.innerHTML = `
        <div class="kimo-modal-card" style="max-width:360px;width:90%;padding:0;text-align:left;overflow:hidden;">
          <div style="padding:22px 24px 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(16,185,129)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              <span style="font-size:16px;font-weight:700;color:var(--text-primary);">加入测试版</span>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;">输入测试版密钥以解锁预览版本更新通道</div>
          </div>
          <div style="padding:20px 24px;">
            <input id="beta-key-input" type="password" placeholder="请输入密钥" autofocus style="width:100%;box-sizing:border-box;padding:10px 14px;font-size:13px;border:1px solid var(--glass-border);border-radius:8px;background:rgba(255,255,255,0.03);color:var(--text-primary);outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='rgb(16,185,129)'" onblur="this.style.borderColor='var(--glass-border)'" />
            <div id="beta-key-error" style="display:none;margin-top:8px;font-size:11px;color:#f87171;">密钥无效，请重新输入</div>
          </div>
          <div style="padding:0 24px 20px;display:flex;gap:10px;">
            <button id="beta-key-cancel" style="flex:1;padding:10px;font-size:13px;font-weight:600;border:1px solid var(--glass-border);border-radius:8px;background:transparent;color:var(--text-secondary);cursor:pointer;">取消</button>
            <button id="beta-key-confirm" style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;border-radius:8px;background:rgb(16,185,129);color:#fff;cursor:pointer;">激活</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#beta-key-input');
      const errTip = overlay.querySelector('#beta-key-error');
      const close = () => overlay.remove();

      const confirm = () => {
        const key = input.value.trim();
        if (setBetaKey(key)) {
          // 更新按钮状态为"已加入测试"
          const betaBtn = card.querySelector('#settings-beta-btn');
          if (betaBtn) {
            betaBtn.style.background = 'rgba(16,185,129,0.1)';
            betaBtn.style.borderColor = 'rgba(16,185,129,0.3)';
            betaBtn.style.color = 'rgb(16,185,129)';
            const label = betaBtn.querySelector('span');
            if (label) label.textContent = '已加入测试';
          }
          showToast('已激活测试版更新通道');
          close();
        } else {
          errTip.style.display = 'block';
          input.value = '';
          input.focus();
        }
      };

      overlay.querySelector('#beta-key-cancel').addEventListener('click', close);
      overlay.querySelector('#beta-key-confirm').addEventListener('click', confirm);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirm();
        if (e.key === 'Escape') close();
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
      // 隐藏错误提示当用户重新输入
      input.addEventListener('input', () => { errTip.style.display = 'none'; });
      setTimeout(() => input.focus(), 50);
    };

    // 检查更新 — 按钮带加载动画
    aboutCard.querySelector('#settings-check-update-btn')?.addEventListener('click', async () => {
      const btn = aboutCard.querySelector('#settings-check-update-btn');
      const textEl = aboutCard.querySelector('#check-update-text');
      const iconEl = aboutCard.querySelector('#check-update-icon');
      const origText = textEl.textContent;

      // 切换到加载状态
      btn.disabled = true;
      btn.style.opacity = '0.6';
      textEl.textContent = '检查中...';
      iconEl.outerHTML = '<svg id="check-update-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" style="animation:kimo-btn-spin 0.8s linear infinite;"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" stroke-dasharray="40 20" stroke-linecap="round"/></svg>';

      try {
        const result = await checkForUpdates(true);
        if (result) {
          // 找到更新，弹窗已由 checkForUpdates 内部弹出
          resetBtn();
        } else {
          textEl.textContent = '已是最新';
          setTimeout(resetBtn, 2000);
        }
      } catch (err) {
        textEl.textContent = '检查失败';
        setTimeout(resetBtn, 2000);
        showToast('检查更新失败，请检查网络连接');
      }

      function resetBtn() {
        btn.disabled = false;
        btn.style.opacity = '1';
        textEl.textContent = origText;
        const cur = aboutCard.querySelector('#check-update-icon');
        if (cur) cur.outerHTML = '<svg id="check-update-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
      }
    });

    // 加入测试 — 弹窗输入密钥
    aboutCard.querySelector('#settings-beta-btn')?.addEventListener('click', () => {
      if (getBetaStatus()) {
        showToast('已激活测试版更新通道');
        return;
      }
      showBetaKeyModal(aboutCard);
    });

    listEl.appendChild(container);

    lyricCard.querySelectorAll('#settings-stagger-group .setting-radio-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        lyricCard.querySelectorAll('#settings-stagger-group .setting-radio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        lyricCard.querySelector('#settings-stagger-group').setAttribute('data-active-idx', idx.toString());
        const val = btn.getAttribute('data-val');
        // ⭐ 修复：使用与 toggleStaggerMode 一致的 localStorage key，并触发 render + realign 让模式真正生效⭐
        localStorage.setItem('kimo-lyrics-stagger-mode', val);
        if (player && player.lyrics) {
          player.lyrics.lyricsStaggerMode = val;
          player.lyrics.updateStaggerUI();
          player.lyrics.render();
          if (player.lyrics.isVisible) {
            player.lyrics.realign();
            if (player.audio) {
              player.lyrics.syncToTime(player.audio.currentTime);
            }
          }
        }
        showToast(`已切换为: ${val === 'stagger' ? '字母依次上移' : '单词整体上移'}`);
      });
    });

    lyricCard.querySelector('#settings-mini-translation').addEventListener('change', (e) => {
      localStorage.setItem('kimo-mini-lyrics-show-translation', e.target.checked);
      applyMiniLyricsTranslationSetting();
      showToast(`已${e.target.checked ? '开启' : '关闭'}迷你歌词翻译`);
    });

    desktopLyricCard.querySelector('#settings-desktop-lyrics')?.addEventListener('change', event => {
      desktopLyrics?.setVisible(event.target.checked);
    });

    const syncDesktopLyricsStyle = () => {
      const sizeVal = desktopLyricCard.querySelector('#settings-desktop-lyrics-size')?.value || 34;
      const opacityVal = desktopLyricCard.querySelector('#settings-desktop-lyrics-opacity')?.value || 0.96;
      const transVal = desktopLyricCard.querySelector('#settings-desktop-lyrics-translation')?.checked;
      const wordByWordVal = desktopLyricCard.querySelector('#settings-desktop-lyrics-word-by-word')?.checked;
      const glowVal = desktopLyricCard.querySelector('#settings-desktop-lyrics-glow')?.checked;
      const strokeVal = desktopLyricCard.querySelector('#settings-desktop-lyrics-stroke')?.checked;
      const themeVal = desktopLyricCard.querySelector('#settings-desktop-lyrics-theme')?.value;
      const alignVal = desktopLyricCard.querySelector('#settings-desktop-lyrics-align')?.value;

      const sizeDisplay = desktopLyricCard.querySelector('#desktop-lyrics-size-val');
      if (sizeDisplay) sizeDisplay.textContent = `${sizeVal}px`;

      const opacityDisplay = desktopLyricCard.querySelector('#desktop-lyrics-opacity-val');
      if (opacityDisplay) opacityDisplay.textContent = `${Math.round(opacityVal * 100)}%`;

      localStorage.setItem('kimo-desktop-lyrics-font-size', sizeVal);
      localStorage.setItem('kimo-desktop-lyrics-opacity', opacityVal);
      localStorage.setItem('kimo-desktop-lyrics-show-translation', transVal ? 'true' : 'false');
      localStorage.setItem('kimo-desktop-lyrics-word-by-word', wordByWordVal ? 'true' : 'false');
      localStorage.setItem('kimo-desktop-lyrics-glow', glowVal ? 'true' : 'false');
      localStorage.setItem('kimo-desktop-lyrics-stroke', strokeVal ? 'true' : 'false');
      if (themeVal) localStorage.setItem('kimo-desktop-lyrics-theme', themeVal);
      if (alignVal) localStorage.setItem('kimo-desktop-lyrics-align', alignVal);
      desktopLyrics?.updateStyle();
    };

    desktopLyricCard.querySelector('#settings-desktop-lyrics-size')?.addEventListener('input', syncDesktopLyricsStyle);
    desktopLyricCard.querySelector('#settings-desktop-lyrics-opacity')?.addEventListener('input', syncDesktopLyricsStyle);

    // 桌面歌词字号滑块滚轮支持
    desktopLyricCard.querySelector('#settings-desktop-lyrics-size')?.addEventListener('wheel', (e) => {
      e.preventDefault();
      const slider = e.target;
      const delta = e.deltaY < 0 ? 1 : -1;
      const nextVal = Math.max(12, Math.min(56, parseInt(slider.value) + delta));
      slider.value = nextVal;
      syncDesktopLyricsStyle();
    }, { passive: false });

    // 桌面歌词透明度滑块滚轮支持
    desktopLyricCard.querySelector('#settings-desktop-lyrics-opacity')?.addEventListener('wheel', (e) => {
      e.preventDefault();
      const slider = e.target;
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const nextVal = Math.max(0.25, Math.min(1, parseFloat(slider.value) + delta));
      slider.value = nextVal;
      syncDesktopLyricsStyle();
    }, { passive: false });
    desktopLyricCard.querySelector('#settings-desktop-lyrics-word-by-word')?.addEventListener('change', (e) => {
      syncDesktopLyricsStyle();
      showToast(`桌面歌词逐字动画: ${e.target.checked ? '开启' : '关闭'}`);
    });
    desktopLyricCard.querySelector('#settings-desktop-lyrics-translation')?.addEventListener('change', syncDesktopLyricsStyle);
    desktopLyricCard.querySelector('#settings-desktop-lyrics-glow')?.addEventListener('change', (e) => {
      syncDesktopLyricsStyle();
      showToast(`字体阴影发光: ${e.target.checked ? '开启' : '关闭'}`);
    });
    desktopLyricCard.querySelector('#settings-desktop-lyrics-stroke')?.addEventListener('change', (e) => {
      syncDesktopLyricsStyle();
      showToast(`字体防瞎描边: ${e.target.checked ? '开启' : '关闭'}`);
    });
    desktopLyricCard.querySelector('#settings-desktop-lyrics-theme')?.addEventListener('change', syncDesktopLyricsStyle);
    desktopLyricCard.querySelector('#settings-desktop-lyrics-align')?.addEventListener('change', syncDesktopLyricsStyle);

    desktopLyricCard.querySelector('#settings-desktop-lyrics-locked')?.addEventListener('change', event => {
      const locked = event.target.checked;
      localStorage.setItem('kimo-desktop-lyrics-locked', locked ? 'true' : 'false');
      desktopLyrics?.updateStyle();
      showToast(locked ? '桌面歌词已锁定(穿透)' : '桌面歌词已解除锁定');
    });

    desktopLyricCard.querySelector('#settings-immersive-hide-titlebar')?.addEventListener('change', event => {
      const hide = event.target.checked;
      localStorage.setItem('kimo-immersive-hide-titlebar', hide ? 'true' : 'false');
      showToast(hide ? '沉浸模式将隐藏标题栏' : '沉浸模式将显示标题栏');
    });

    lyricCard.querySelector('#settings-lyrics-row-follow')?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      updateLyricsPreference('rowFollowEnabled', enabled);
      showToast(`已${enabled ? '开启' : '关闭'}歌词逐行跟随动画`);
    });

    const perfCheckbox = perfCard.querySelector('#settings-perf-mode');
    perfCheckbox?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('kimo-performance-mode', enabled ? 'true' : 'false');
      document.body.classList.toggle('perf-mode', enabled);
      if (player && player.lyrics) {
        player.lyrics.clearBlur();
        if (player.lyrics.isVisible && player.audio) {
          player.lyrics.syncToTime(player.audio.currentTime);
        }
      }
      showToast(`已${enabled ? '开启低功耗性能模式 (Intel 集显优化)' : '关闭低功耗性能模式'}`);
    });

        // 主题分段钮组事件监听
    themeCard.querySelectorAll('#settings-theme-group .setting-radio-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        themeCard.querySelectorAll('#settings-theme-group .setting-radio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        themeCard.querySelector('#settings-theme-group').setAttribute('data-active-idx', idx.toString());
        const val = btn.getAttribute('data-val');
        const isCustom = localStorage.getItem('kimo-overlay-opacity-custom') === 'true';
        const op = isCustom ? localStorage.getItem('kimo-overlay-opacity') : null;
        applyTheme(val, op);
        showToast(`已切换至: ${val === 'light' ? '浅色遮罩主题' : (val === 'grey' ? '雅致灰色主题' : '深色遮罩主题')}`);
      });
    });

    // 歌词页面主题分段钮组事件监听
    themeCard.querySelectorAll('#settings-lyrics-theme-group .setting-radio-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        themeCard.querySelectorAll('#settings-lyrics-theme-group .setting-radio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        themeCard.querySelector('#settings-lyrics-theme-group').setAttribute('data-active-idx', idx.toString());
        const val = btn.getAttribute('data-val');
        localStorage.setItem('kimo-lyrics-theme', val);
        applyLyricsTheme(val);
        showToast(`歌词页面主题已切换至: ${val === 'follow' ? '自动' : (val === 'light' ? '浅色' : '深色')}`);
      });
    });

    // UI 风格分段钮组事件监听
    themeCard.querySelectorAll('#settings-ui-style-group .setting-radio-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        themeCard.querySelectorAll('#settings-ui-style-group .setting-radio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        themeCard.querySelector('#settings-ui-style-group').setAttribute('data-active-idx', idx.toString());
        const val = btn.getAttribute('data-val');
        localStorage.setItem('kimo-ui-style', val);
        applyUiStyle(val);
        const styleNames = { acrylic: '亚克力', gaussian: '高斯模糊', liquid: '液态玻璃', solid: '默认效果' };
        showToast(`UI 风格已切换至: ${styleNames[val] || val}`);
      });
    });

    // 背景样式分段钮组事件监听
    themeCard.querySelectorAll('#settings-bg-style-group .setting-radio-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        themeCard.querySelectorAll('#settings-bg-style-group .setting-radio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        themeCard.querySelector('#settings-bg-style-group').setAttribute('data-active-idx', idx.toString());
        const val = btn.getAttribute('data-val');
        localStorage.setItem('kimo-bg-style', val);
        applyBackgroundStyle(val);
        // 显示/隐藏旋转速率滑块
        const speedRow = themeCard.querySelector('#settings-bg-rotate-speed-row');
        if (speedRow) speedRow.style.display = val === 'dynamic' ? 'flex' : 'none';
        const bgNames = { none: '去除背景', static: '静态背景', dynamic: '动态背景' };
        showToast(`背景样式已切换至: ${bgNames[val] || val}`);
      });
    });

    // 动态背景旋转速率滑块
    const bgRotateSpeedSlider = themeCard.querySelector('#settings-slider-bg-rotate-speed');
    if (bgRotateSpeedSlider) {
      // 拖动时：暂停旋转，仅更新百分比显示
      bgRotateSpeedSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        const display = themeCard.querySelector('#settings-bg-rotate-speed-val');
        if (display) display.textContent = `${val}%`;
        // 暂停旋转动画
        document.documentElement.style.setProperty('--bg-rotate-play-state', 'paused');
      });
      // 释放后：保存设置，恢复旋转并应用新速率
      bgRotateSpeedSlider.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        localStorage.setItem('kimo-bg-rotate-speed', String(val));
        // 百分比转持续时长：100% → 10s, 50% → 20s, 10% → 100s
        const duration = Math.round(1000 / val);
        document.documentElement.style.setProperty('--bg-rotate-duration', `${duration}s`);
        // 恢复旋转动画
        document.documentElement.style.setProperty('--bg-rotate-play-state', 'running');
      });

      // 滚轮支持
      bgRotateSpeedSlider.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 5 : -5;
        const nextVal = Math.max(10, Math.min(100, parseInt(bgRotateSpeedSlider.value) + delta));
        bgRotateSpeedSlider.value = nextVal;
        const display = themeCard.querySelector('#settings-bg-rotate-speed-val');
        if (display) display.textContent = `${nextVal}%`;
        // 立即应用并恢复旋转
        localStorage.setItem('kimo-bg-rotate-speed', String(nextVal));
        const duration = Math.round(1000 / nextVal);
        document.documentElement.style.setProperty('--bg-rotate-duration', `${duration}s`);
        document.documentElement.style.setProperty('--bg-rotate-play-state', 'running');
      }, { passive: false });
    }

    const interfaceFontSelect = themeCard.querySelector('#settings-interface-font');
    const customFontButton = themeCard.querySelector('#settings-custom-font-btn');
    const customFontFile = themeCard.querySelector('#settings-custom-font-file');
    let currentFontMode = getStoredInterfaceFont().mode;

    const chooseCustomFont = async () => {
      try {
        const selected = await open({
          multiple: false,
          filters: [{
            name: '字体文件',
            extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc'],
          }],
        });
        if (!selected) return false;

        await applyInterfaceFont('custom', selected);
        currentFontMode = 'custom';
        interfaceFontSelect.value = 'custom';
        customFontFile.textContent = getFontFileName(selected);
        customFontFile.title = selected;
        showToast('已应用自定义界面字体');
        return true;
      } catch (error) {
        console.error('[InterfaceFont] Failed to apply custom font:', error);
        showToast('字体文件无法加载，请尝试其他字体');
        return false;
      }
    };

    interfaceFontSelect?.addEventListener('change', async (event) => {
      const nextMode = event.target.value;
      if (nextMode === 'custom') {
        const storedFont = getStoredInterfaceFont();
        if (storedFont.customPath) {
          try {
            await applyInterfaceFont('custom', storedFont.customPath);
            currentFontMode = 'custom';
            showToast('已切换至自定义界面字体');
            return;
          } catch (error) {
            console.warn('[InterfaceFont] Saved custom font is unavailable:', error);
          }
        }

        const applied = await chooseCustomFont();
        if (!applied) event.target.value = currentFontMode;
        return;
      }

      await applyInterfaceFont(nextMode);
      currentFontMode = nextMode;
      const preset = INTERFACE_FONT_PRESETS.find(item => item.value === nextMode);
      showToast(`已切换至${preset?.label || '默认字体'}`);
    });

    customFontButton?.addEventListener('click', chooseCustomFont);

    const opInput = themeCard.querySelector('#settings-slider-opacity');
    const opDisplay = themeCard.querySelector('#settings-opacity-val');
    opInput.addEventListener('input', (e) => {
      const percentage = parseInt(e.target.value, 10);
      opDisplay.textContent = `${percentage}%`;
      const val = percentage / 100;
      localStorage.setItem('kimo-overlay-opacity-custom', 'true');
      applyTheme(getCurrentTheme(), val.toString());
    });
    opInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      const nextVal = Math.max(0, Math.min(100, parseInt(opInput.value) + delta));
      opInput.value = nextVal;
      opDisplay.textContent = `${nextVal}%`;
      const val = nextVal / 100;
      localStorage.setItem('kimo-overlay-opacity-custom', 'true');
      applyTheme(getCurrentTheme(), val.toString());
    }, { passive: false });

    const zoomInput = themeCard.querySelector('#settings-slider-zoom');
    const zoomDisplay = themeCard.querySelector('#settings-zoom-val');
    zoomInput.addEventListener('input', (e) => {
      const percentage = parseInt(e.target.value, 10);
      zoomDisplay.textContent = `${percentage}%`;
      const val = percentage / 100;
      document.documentElement.style.setProperty('--ui-scale', val.toString());
      document.documentElement.style.zoom = val.toString();
      localStorage.setItem('kimo-ui-scale', val.toString());
    });
    zoomInput.addEventListener('change', (e) => {
      const percentage = parseInt(e.target.value, 10);
      const val = percentage / 100;
      localStorage.setItem('kimo-ui-scale', val.toString());
    });
    zoomInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      const nextVal = Math.max(80, Math.min(120, parseInt(zoomInput.value) + delta));
      zoomInput.value = nextVal;
      zoomDisplay.textContent = `${nextVal}%`;
      const val = nextVal / 100;
      document.documentElement.style.setProperty('--ui-scale', val.toString());
      document.documentElement.style.zoom = val.toString();
      localStorage.setItem('kimo-ui-scale', val.toString());
    }, { passive: false });

    themeCard.querySelector('#settings-show-quality-badge')?.addEventListener('change', (e) => {
      localStorage.setItem('kimo-show-quality-badge', e.target.checked ? 'true' : 'false');
      showToast(e.target.checked ? '已开启音质标签展示 (SQ/Hi-Res/HQ)' : '已关闭音质标签展示');
      if (player && typeof player.updateUI === 'function' && player.playlist && player.playlist[player.currentIndex]) {
        player.updateUI(player.playlist[player.currentIndex]);
      }
    });

    themeCard.querySelector('#settings-show-bitrate-badge')?.addEventListener('change', (e) => {
      localStorage.setItem('kimo-show-bitrate-badge', e.target.checked ? 'true' : 'false');
      showToast(e.target.checked ? '已开启码率标签展示' : '已关闭码率标签展示');
      if (player && typeof player.updateUI === 'function' && player.playlist && player.playlist[player.currentIndex]) {
        player.updateUI(player.playlist[player.currentIndex]);
      }
    });

    // ══ 专辑封面取色设置 ══
    // 取色开关
    const colorToggle = themeCard.querySelector('#settings-color-extraction-toggle');
    colorToggle?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('kimo-color-extraction', enabled ? 'on' : 'off');
      // 显示/隐藏取色模式行
      const modeRow = themeCard.querySelector('#settings-color-mode-row');
      if (modeRow) modeRow.style.display = enabled ? 'flex' : 'none';
      // 隐藏手动模式下的深浅滑块行
      if (!enabled) {
        const intensityRow = themeCard.querySelector('#settings-color-intensity-row');
        if (intensityRow) intensityRow.style.display = 'none';
      } else {
        // 恢复显示（取决于当前模式）
        const currentMode = localStorage.getItem('kimo-color-mode') || 'smart';
        const intensityRow = themeCard.querySelector('#settings-color-intensity-row');
        if (intensityRow) intensityRow.style.display = currentMode === 'manual' ? 'flex' : 'none';
      }
      reapplyCurrentColor();
      showToast(enabled ? '已开启专辑封面取色' : '已关闭专辑封面取色，使用默认主题色');
    });

    // 取色模式分段按钮组
    themeCard.querySelectorAll('#settings-color-mode-group .setting-radio-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        themeCard.querySelectorAll('#settings-color-mode-group .setting-radio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        themeCard.querySelector('#settings-color-mode-group').setAttribute('data-active-idx', idx.toString());
        const mode = btn.getAttribute('data-val');
        localStorage.setItem('kimo-color-mode', mode);
        // 显示/隐藏深浅滑块行
        const intensityRow = themeCard.querySelector('#settings-color-intensity-row');
        if (intensityRow) intensityRow.style.display = mode === 'manual' ? 'flex' : 'none';
        reapplyCurrentColor();
        const modeNames = { smart: '智能取色', manual: '手动调节' };
        showToast(`取色模式已切换至: ${modeNames[mode] || mode}`);
      });
    });

    // 取色深浅滑块
    const colorIntensityInput = themeCard.querySelector('#settings-slider-color-intensity');
    const colorIntensityDisplay = themeCard.querySelector('#settings-color-intensity-val');
    if (colorIntensityInput) {
      // 拖动时实时更新显示和预览
      colorIntensityInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (colorIntensityDisplay) colorIntensityDisplay.textContent = val > 0 ? `+${val}` : `${val}`;
        localStorage.setItem('kimo-color-intensity', val);
        reapplyCurrentColor();
      });
      // 滚轮支持
      colorIntensityInput.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        const nextVal = Math.max(-50, Math.min(50, parseInt(colorIntensityInput.value) + delta));
        colorIntensityInput.value = nextVal;
        if (colorIntensityDisplay) colorIntensityDisplay.textContent = nextVal > 0 ? `+${nextVal}` : `${nextVal}`;
        localStorage.setItem('kimo-color-intensity', nextVal);
        reapplyCurrentColor();
      }, { passive: false });
    }

    const fsInput = lyricCard.querySelector('#settings-slider-font-size');
    const fsDisplay = lyricCard.querySelector('#settings-font-size-val');
    fsInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      fsDisplay.innerText = `${val.toFixed(1)}px`;
      document.documentElement.style.setProperty('--lyrics-font-size', `${val}px`);
      if (player && player.lyrics) player.lyrics.resetAlignmentCache();
    });
    fsInput.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      localStorage.setItem('kimo-lyrics-font-size', val);
    });
    fsInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      const nextVal = Math.max(16, Math.min(48, parseFloat(fsInput.value) + delta));
      fsInput.value = nextVal;
      fsDisplay.innerText = `${nextVal.toFixed(1)}px`;
      document.documentElement.style.setProperty('--lyrics-font-size', `${nextVal}px`);
      if (player && player.lyrics) player.lyrics.resetAlignmentCache();
      localStorage.setItem('kimo-lyrics-font-size', nextVal);
    }, { passive: false });

    const liftInput = lyricCard.querySelector('#settings-slider-lift');
    const liftDisplay = lyricCard.querySelector('#settings-lift-val');
    liftInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      liftDisplay.innerText = `${val}px`;
    });
    liftInput.addEventListener('change', (e) => {
      const val = parseInt(e.target.value);
      updateLyricsPreference('liftAmplitude', val);
    });
    liftInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      const nextVal = Math.max(0, Math.min(5, parseInt(liftInput.value) + delta));
      liftInput.value = nextVal;
      liftDisplay.innerText = `${nextVal}px`;
      updateLyricsPreference('liftAmplitude', nextVal);
    }, { passive: false });

    const spacingInput = lyricCard.querySelector('#settings-slider-line-spacing');
    const spacingDisplay = lyricCard.querySelector('#settings-line-spacing-val');
    const applyLineSpacing = (val) => {
      spacingDisplay.innerText = `${parseFloat(val).toFixed(2)}`;
      document.documentElement.style.setProperty('--lyrics-line-spacing', val);
    };
    spacingInput.addEventListener('input', (e) => {
      applyLineSpacing(parseFloat(e.target.value));
    });
    spacingInput.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      localStorage.setItem('kimo-lyrics-line-spacing', val);
    });
    spacingInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const nextVal = Math.max(0, Math.min(2.0, parseFloat(spacingInput.value) + delta));
      spacingInput.value = nextVal;
      applyLineSpacing(nextVal);
      localStorage.setItem('kimo-lyrics-line-spacing', nextVal);
    }, { passive: false });

    const asrUrlInput = aiCard.querySelector('#settings-asr-url');
    aiCard.querySelector('#settings-save-asr-btn').addEventListener('click', () => {
      const url = asrUrlInput.value.trim();
      localStorage.setItem('kimo-ai-server-url', url);
      showToast('AI ASR 服务器地址保存成功');
    });

    scanCard.querySelectorAll('.scanned-path-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        scannedDirs.splice(idx, 1);
        localStorage.setItem('kimo-scanned-dirs', JSON.stringify(scannedDirs));
        showToast('已移出该扫描路径');
        renderSettingsTab();
      });
    });

    scanCard.querySelector('#settings-clear-dirs').addEventListener('click', async () => {
    if (await customConfirm('确定要清空所有本地音乐的缓存及扫描路径列表吗？此操作不可恢复。')) {
        localStorage.removeItem('kimo-scanned-dirs');
        localStorage.removeItem('kimo-scanned-dir');
        localStorage.removeItem('kimo-playlist-cache');
        localStorage.removeItem('kimo-music-library');
        player.playlist = [];
        setMusicLibrary([]);
        clearSearchCache();
        clearLyricsDB();
        showToast('歌曲缓存已清除');
        renderSettingsTab();
      }
    });

    scanCard.querySelector('#settings-add-dir-btn').addEventListener('click', async () => {
      try {
        const selected = await open({ directory: true, multiple: true });
        if (!selected) return;
        
        const newPaths = Array.isArray(selected) ? selected : [selected];
        newPaths.forEach(p => {
          if (!scannedDirs.includes(p)) {
            scannedDirs.push(p);
          }
        });

        localStorage.setItem('kimo-scanned-dirs', JSON.stringify(scannedDirs));
        showToast('成功添加扫描文件夹');
        renderSettingsTab();
      } catch (e) {
        console.error('Add directory error:', e);
        showToast('选择文件夹失败');
      }
    });

    scanCard.querySelector('#settings-scan-btn').addEventListener('click', async () => {
      if (scannedDirs.length === 0) {
        showToast('请先添加需要扫描的文件夹目标');
        return;
      }

      const scanBtn = scanCard.querySelector('#settings-scan-btn');
      scanBtn.disabled = true;
      scanBtn.innerText = '正在扫描目录...';
      
      try {
        const allFiles = [];
        for (const dir of scannedDirs) {
          try {
            const files = await invoke('scan_directory', { dir });
            if (Array.isArray(files)) {
              allFiles.push(...files);
            }
          } catch(err) {
             console.error('Scan failed for dir:', dir, err);
          }
        }

        const uniqueFiles = Array.from(new Set(allFiles));
        
        if (uniqueFiles.length === 0) {
          showToast('未在指定文件夹中检索到音频文件');
          scanBtn.disabled = false;
          scanBtn.innerText = '立即重新扫描';
          return;
        }

        scanBtn.innerText = `正在读取元数据(0/${uniqueFiles.length})...`;
        
        const tempPlaylist = [];
        for (let i = 0; i < uniqueFiles.length; i++) {
          try {
            scanBtn.innerText = `正在读取元数据(${i + 1}/${uniqueFiles.length})...`;
            const meta = await invoke('read_audio_metadata', { path: uniqueFiles[i] });
            if (meta) {
              tempPlaylist.push(meta);
            }
          } catch (e) {
            console.error('Failed to read metadata for', uniqueFiles[i], e);
          }
        }

        if (tempPlaylist.length > 0) {
          setMusicLibrary(tempPlaylist);
          player.playlist = [...tempPlaylist]; // 初次扫描时把全部歌曲同时设为播放列表
          resetDiscoverRecommendations();

          // ⭐ localStorage 不存大字段（cover_image data URI 可能超5MB 配额），先精简再存 ⭐
                    const slimPlaylist = tempPlaylist.map(s => ({
            file_path: s.file_path,
            title: s.title,
            artist: s.artist,
            album: s.album,
            duration: s.duration,
            year: s.year,
            track_number: s.track_number,
            genre: s.genre,
            bitrate: s.bitrate,
            // ⭐ 封面仅保留路径引用，data URI 留空（启动时 backgroundLoadCovers 会按需补全）。
            cover_image: typeof s.cover_image === 'string' && s.cover_image.startsWith('data:') ? null : s.cover_image,
          }));

          try {
            localStorage.setItem('kimo-music-library', JSON.stringify(slimPlaylist));
            localStorage.setItem('kimo-playlist-cache', JSON.stringify(slimPlaylist));
          } catch (e) {
            console.warn('localStorage 写入失败（配额满？），已跳过持久化：', e);
          }

          // ⭐ 异步加载封面（不阻塞扫描完成提示）。
          backgroundLoadCovers(player.playlist);

          showToast(`扫描完成！共导入 ${tempPlaylist.length} 首歌曲`);
          // ⭐ 隔离 switchTab 错误，避免渲染错误覆盖成功提示⭐
          try {
            switchTab('local');
          } catch (tabErr) {
            console.error('switchTab error after scan:', tabErr);
          }
          scanBtn.disabled = false;
          scanBtn.innerText = '立即重新扫描';
        } else {
          showToast('扫描完成，未读取到有效的音频文件元数据');
          scanBtn.disabled = false;
          scanBtn.innerText = '立即重新扫描';
        }
      } catch(err) {
        console.error('Global scan error:', err);
        showToast('扫描失败，请重试');
        scanBtn.disabled = false;
        scanBtn.innerText = '立即重新扫描';
      }
    });
  };

  return renderSettingsTab;
};
