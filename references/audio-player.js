// 悬浮音频播放器组件
(function () {
    'use strict';

    // 暴露给全局以便 chat.js 调用
    window.FloatingAudioPlayer = {
        show: showFloatingAudioPlayer,
        hide: hideFloatingAudioPlayer,
        update: updateFloatingAudioPlayer,
        addToPlaylistAndPlay: addToPlaylistAndPlay,
        getOrCreateAudioKeeper: getOrCreateAudioKeeper,
        movePlayingAudioToKeeper: movePlayingAudioToKeeper,
        handlePlay: handlePlay,
        handlePause: handlePause,
        handleEnded: handleEnded,
        handleTimeUpdate: handleTimeUpdate,
        handleLoadedMetadata: handleLoadedMetadata
    };

    var floatingAudioPlayer = null;
    var currentFloatingAudio = null;
    var currentMediaSessionAudio = null;
    var mediaSessionPositionState = null;
    var floatingPlayerUpdateInterval = null;
    var isDraggingFloatingProgress = false;
    var floatingProgressDidMove = false;
    var wasPlayingBeforeDrag = false;
    var floatingProgressClickPercent = 0;
    var lastDragPercent = 0;
    var floatingProgressDownX = 0;
    var floatingProgressDownTime = 0;
    var FLOATING_PROGRESS_MOVE_THRESHOLD_PX = 5;
    var FLOATING_PROGRESS_SHORT_PRESS_MS = 400;
    var floatingPlayerMiniMode = false;
    var cachedAudioName = '';
    var cachedArtistName = '';
    var cachedAlbumCover = null;

    // ── 歌词状态 ──
    var lyricsData = null;       // { lines: [...], hasTimestamps: bool }
    var lyricsCurrentLine = -1;  // 当前高亮行索引
    var lyricsPanelOpen = false;
    var lyricsLoadedUrl = '';    // 已加载歌词的音频 URL（避免重复请求）


    var audioPlaylist = [];
    var audioPlaylistIndex = -1;
    var audioPlaylistLoopMode = 'list'; // list, single, none
    var audioPlaylistSpeed = parseFloat(localStorage.getItem('kiso_audio_speed')) || 1.0;
    var playlistAudioEl = null;
    var playlistPanelEl = null;

    var audioInitInProgress = new Set(); // 虽然主要在 chat.js 使用，但为了完整性... 其实不需要，chat.js 管理 init 状态

    function formatAudioTime(seconds) {
        if (!isFinite(seconds) || isNaN(seconds)) return '--:--';
        var s = Math.floor(seconds);
        var m = Math.floor(s / 60);
        s = s % 60;
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }
    window.formatAudioTime = formatAudioTime;

    function escapeHtml(text) {
        if (text == null || text === '') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function toAbsoluteUrl(url) {
        if (!url || typeof url !== 'string') return url;
        if (url.indexOf('://') !== -1 || url.indexOf('//') === 0) return url;
        try {
            return new URL(url, window.location.origin).href;
        } catch (e) {
            return window.location.origin + (url.indexOf('/') === 0 ? '' : '/') + url;
        }
    }

    function getAudioNameWithoutExt(name) {
        if (!name) return '音频';
        var lastDot = name.lastIndexOf('.');
        if (lastDot <= 0 || lastDot >= name.length - 1) return name;
        var ext = name.substring(lastDot + 1).toLowerCase();
        var exts = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'wma', 'opus', 'mp4', 'm4v'];
        if (exts.indexOf(ext) !== -1) return name.substring(0, lastDot);
        return name;
    }

    function getOrCreateAudioKeeper() {
        var keeper = document.getElementById('chat-audio-keeper');
        if (!keeper) {
            keeper = document.createElement('div');
            keeper.id = 'chat-audio-keeper';
            keeper.setAttribute('aria-hidden', 'true');
            keeper.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;overflow:hidden;pointer-events:none;';
            document.body.appendChild(keeper);
        }
        return keeper;
    }

    function movePlayingAudioToKeeper() {
        if (!currentFloatingAudio) return;
        if (!currentFloatingAudio.parentNode) return;
        var keeper = getOrCreateAudioKeeper();
        if (currentFloatingAudio.parentNode !== keeper) {
            keeper.appendChild(currentFloatingAudio);
        }
    }

    function getOrCreatePlaylistAudio() {
        if (playlistAudioEl && document.body.contains(playlistAudioEl)) return playlistAudioEl;
        playlistAudioEl = document.createElement('audio');
        playlistAudioEl.id = 'chatPlaylistAudio';
        playlistAudioEl.className = 'chat-message-audio-player';
        playlistAudioEl.preload = 'metadata';
        var keeper = getOrCreateAudioKeeper();
        keeper.appendChild(playlistAudioEl);

        playlistAudioEl.addEventListener('play', function () {
            handlePlay(playlistAudioEl, null);
        });
        playlistAudioEl.addEventListener('pause', function () {
            handlePause(playlistAudioEl);
        });
        playlistAudioEl.addEventListener('timeupdate', function () {
            handleTimeUpdate(playlistAudioEl, null);
        });
        playlistAudioEl.addEventListener('loadedmetadata', function () {
            handleLoadedMetadata(playlistAudioEl, null);
        });

        playlistAudioEl.addEventListener('ended', function () {
            if (currentFloatingAudio !== playlistAudioEl) return;
            if (audioPlaylistLoopMode === 'single' && audioPlaylistIndex >= 0) {
                playlistAudioEl.currentTime = 0;
                playlistAudioEl.play().catch(function () { });
                return;
            }
            if (audioPlaylistLoopMode === 'list' && audioPlaylist.length > 0) {
                var nextIndex = (audioPlaylistIndex + 1) % audioPlaylist.length;
                playPlaylistTrack(nextIndex);
                return;
            }
            hideFloatingAudioPlayer();
            currentFloatingAudio = null;
        });
        return playlistAudioEl;
    }

    function addToPlaylistAndPlay(track) {
        if (!track || !track.audioUrl) return;
        var url = track.audioUrl;
        var existingIndex = -1;
        for (var i = 0; i < audioPlaylist.length; i++) {
            if (audioPlaylist[i].audioUrl === url) {
                existingIndex = i;
                break;
            }
        }
        if (existingIndex >= 0) {
            audioPlaylistIndex = existingIndex;
            playPlaylistTrack(audioPlaylistIndex);
            return;
        }
        var item = {
            audioUrl: track.audioUrl,
            audioType: track.audioType || 'audio/mpeg',
            audioName: track.audioName || '音频',
            artist: track.artist != null ? track.artist : (track.senderName || ''),
            senderName: track.senderName || '聊天消息',
            messageId: track.messageId,
            roomId: track.roomId,
            albumCover: track.albumCover || null
        };
        audioPlaylist.push(item);
        audioPlaylistIndex = audioPlaylist.length - 1;
        playPlaylistTrack(audioPlaylistIndex);
    }

    function playPlaylistTrack(index) {
        if (index < 0 || index >= audioPlaylist.length) return;
        audioPlaylistIndex = index;
        var track = audioPlaylist[index];
        var audio = getOrCreatePlaylistAudio();
        audio.pause();
        audio.removeAttribute('src');
        audio.innerHTML = '';
        var src = document.createElement('source');
        src.src = track.audioUrl;
        src.type = track.audioType || 'audio/mpeg';
        audio.appendChild(src);
        audio.appendChild(document.createTextNode('您的浏览器不支持音频播放'));
        audio.load();

        currentFloatingAudio = audio;
        audio.playbackRate = audioPlaylistSpeed;

        audio.play().then(function () {
            showFloatingAudioPlayer(audio, null, track);
            updateFloatingAudioPlayer();
            renderPlaylistPanel();
            
            // 触发曲目变化事件，供音乐页面同步播放状态
            window.dispatchEvent(new CustomEvent('audio-player-track-change', {
                detail: {
                    index: index,
                    track: track
                }
            }));
        }).catch(function (err) { console.error('[FloatingPlayer] 播放列表播放失败:', err); });
    }

    function goPrevTrack() {
        if (audioPlaylist.length === 0) return;
        var nextIndex = audioPlaylistIndex <= 0 ? (audioPlaylistLoopMode === 'list' ? audioPlaylist.length - 1 : 0) : audioPlaylistIndex - 1;
        if (nextIndex === audioPlaylistIndex && audioPlaylistLoopMode !== 'list') return;
        playPlaylistTrack(nextIndex);
    }

    function goNextTrack() {
        if (audioPlaylist.length === 0) return;
        var nextIndex = audioPlaylistIndex >= audioPlaylist.length - 1 ? (audioPlaylistLoopMode === 'list' ? 0 : audioPlaylistIndex) : audioPlaylistIndex + 1;
        if (nextIndex === audioPlaylistIndex && audioPlaylistLoopMode !== 'list') return;
        playPlaylistTrack(nextIndex);
    }

    function cycleLoopMode() {
        var modes = ['list', 'single', 'none'];
        var i = modes.indexOf(audioPlaylistLoopMode);
        audioPlaylistLoopMode = modes[(i + 1) % 3];
        updateFloatingAudioPlayer();
        renderPlaylistPanel();
    }

    function cyclePlaybackSpeed() {
        var speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
        var currentIndex = speeds.indexOf(audioPlaylistSpeed);
        if (currentIndex === -1) currentIndex = 2;
        audioPlaylistSpeed = speeds[(currentIndex + 1) % speeds.length];
        localStorage.setItem('kiso_audio_speed', audioPlaylistSpeed);
        
        if (currentFloatingAudio) {
            currentFloatingAudio.playbackRate = audioPlaylistSpeed;
        }
        
        if (floatingAudioPlayer) {
            var speedText = floatingAudioPlayer.querySelector('.chat-floating-audio-speed-text');
            if (speedText) {
                speedText.textContent = (audioPlaylistSpeed % 1 === 0 ? audioPlaylistSpeed.toFixed(1) : audioPlaylistSpeed) + 'x';
            }
        }
    }

    function renderPlaylistPanel() {
        var panel = document.getElementById('chatFloatingPlaylistPanel');
        if (!panel) return;
        var listEl = panel.querySelector('.chat-floating-audio-playlist-list');
        if (!listEl) return;
        if (audioPlaylist.length === 0) {
            listEl.innerHTML = '<div class="chat-floating-audio-playlist-empty">暂无歌曲，点击聊天中的音频加入</div>';
            return;
        }
        var html = audioPlaylist.map(function (item, index) {
            var title = (item.audioName && item.audioName.trim()) ? item.audioName.trim() : '未知';
            var artist = (item.artist != null && String(item.artist).trim()) ? String(item.artist).trim() : '';
            var line = artist ? (title + ' - ' + artist) : title;
            var active = index === audioPlaylistIndex ? ' chat-floating-audio-playlist-item-active' : '';
            return '<div class="chat-floating-audio-playlist-item' + active + '" data-index="' + index + '" role="button" tabindex="0">' +
                '<span class="chat-floating-audio-playlist-item-num">' + (index + 1) + '</span>' +
                '<span class="chat-floating-audio-playlist-item-title">' + escapeHtml(line) + '</span>' +
                '</div>';
        }).join('');
        listEl.innerHTML = html;
        listEl.querySelectorAll('.chat-floating-audio-playlist-item').forEach(function (el) {
            var index = parseInt(el.dataset.index, 10);
            el.addEventListener('click', function () { playPlaylistTrack(index); });
            el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playPlaylistTrack(index); } });
        });
    }

    function pauseAllOtherAudios(currentAudioId) {
        // 暂停所有音频，包括未初始化的
        var allAudios = document.querySelectorAll('.chat-message-audio-player');
        allAudios.forEach(function (otherAudio) {
            if (otherAudio.id !== currentAudioId) {
                if (!otherAudio.paused) {
                    otherAudio.pause();
                    otherAudio.currentTime = 0; // 重置进度
                }
                // 更新其他音频卡片的播放按钮状态为播放图标
                var otherPlayBtn = document.querySelector('.chat-message-audio-play-btn[data-audio-id="' + otherAudio.id + '"]');
                if (otherPlayBtn) {
                    var otherIcon = otherPlayBtn.querySelector('i');
                    if (otherIcon) {
                        otherIcon.className = 'fas fa-play';
                    }
                    otherPlayBtn.style.opacity = '';
                    var otherWrap = otherAudio.closest('.chat-message-audio-wrap');
                    if (otherWrap) {
                        otherWrap.classList.remove('playing');
                    }
                }
            }
        });
        // 如果当前悬浮播放器显示的是其他音频，也隐藏它
        if (currentFloatingAudio && currentFloatingAudio.id !== currentAudioId) {
            hideFloatingAudioPlayer();
        }
    }

    function ensureFloatingAudioPlayer() {
        if (floatingAudioPlayer && document.body.contains(floatingAudioPlayer)) {
            return floatingAudioPlayer;
        }
        floatingAudioPlayer = document.createElement('div');
        floatingAudioPlayer.id = 'chatFloatingAudioPlayer';
        floatingAudioPlayer.className = 'chat-floating-audio-player';
        floatingAudioPlayer.innerHTML =
            '<div class="chat-floating-audio-content">' +
            '<div class="chat-floating-audio-card-actions" aria-label="卡片操作">' +
            '<button type="button" class="chat-floating-audio-minimize-btn" aria-label="收起"><i class="fas fa-chevron-down"></i></button>' +
            '<button type="button" class="chat-floating-audio-close" aria-label="关闭"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '<div class="chat-floating-audio-top">' +
            '<div class="chat-floating-audio-cover-wrap">' +
            '<div class="chat-floating-audio-icon">' +
            '<img class="chat-floating-audio-cover" style="display: none;" alt="专辑封面">' +
            '<i class="fas fa-music chat-floating-audio-icon-default"></i>' +
            '</div>' +
            '</div>' +
            '<div class="chat-floating-audio-right">' +
            '<div class="chat-floating-audio-collapsible chat-floating-audio-title-row">' +
            '<div class="chat-floating-audio-title-scroll" aria-hidden="true">' +
            '<span class="chat-floating-audio-title-scroll-inner">' +
            '<span class="chat-floating-audio-title">未播放</span>' +
            '<span class="chat-floating-audio-artist">KISO Chat</span>' +
            '</span>' +
            '</div>' +
            '<button type="button" class="chat-floating-audio-expand-btn" aria-label="展开"><i class="fas fa-chevron-up"></i></button>' +
            '</div>' +
            '<div class="chat-floating-audio-buttons-row">' +
            '<div class="chat-floating-audio-buttons">' +
            '<button type="button" class="chat-floating-audio-prev-btn" aria-label="上一首"><i class="fas fa-step-backward"></i></button>' +
            '<button type="button" class="chat-floating-audio-play-btn" aria-label="播放/暂停"><i class="fas fa-play"></i></button>' +
            '<button type="button" class="chat-floating-audio-next-btn" aria-label="下一首"><i class="fas fa-step-forward"></i></button>' +
            '<button type="button" class="chat-floating-audio-loop-btn" aria-label="循环模式"><span class="chat-floating-audio-loop-icon-wrap"><i class="fas fa-sync-alt"></i><span class="chat-floating-audio-loop-one">1</span></span></button>' +
            '<button type="button" class="chat-floating-audio-speed-btn" aria-label="倍速播放"><span class="chat-floating-audio-speed-text">' + (audioPlaylistSpeed % 1 === 0 ? audioPlaylistSpeed.toFixed(1) : audioPlaylistSpeed) + 'x</span></button>' +
            '<button type="button" class="chat-floating-audio-lyrics-btn" aria-label="歌词"><i class="fas fa-align-left"></i></button>' +
            '<button type="button" class="chat-floating-audio-list-btn" aria-label="播放列表"><i class="fas fa-list"></i></button>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="chat-floating-audio-collapsible chat-floating-audio-progress-row">' +
            '<span class="chat-floating-audio-time-current">00:00</span>' +
            '<div class="chat-floating-audio-progress-wrap">' +
            '<div class="chat-floating-audio-progress-bar-slot">' +
            '<div class="chat-floating-audio-progress-bar">' +
            '<div class="chat-floating-audio-progress-filled"></div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<span class="chat-floating-audio-time-total">--:--</span>' +
            '</div>' +
            '<div class="chat-floating-audio-lyrics-panel" id="chatFloatingLyricsPanel" aria-hidden="true">' +
            '<div class="chat-floating-audio-lyrics-header">' +
            '<span class="chat-floating-audio-lyrics-title">歌词</span>' +
            '<div class="chat-floating-audio-lyrics-controls">' +
            '<button type="button" class="lyrics-zoom-out" aria-label="缩小字号" title="缩小字号"><i class="fas fa-A"></i><i class="fas fa-minus" style="font-size:0.6em;transform:translateY(-4px);"></i></button>' +
            '<button type="button" class="lyrics-zoom-in" aria-label="放大字号" title="放大字号"><i class="fas fa-A"></i><i class="fas fa-plus" style="font-size:0.6em;transform:translateY(-4px);"></i></button>' +
            '</div></div>' +
            '<div class="chat-floating-audio-lyrics-body">' +
            '<div class="chat-floating-audio-lyrics-empty">暂无歌词</div>' +
            '</div>' +
            '</div>' +
            '<div class="chat-floating-audio-playlist-panel" id="chatFloatingPlaylistPanel" aria-hidden="true">' +
            '<div class="chat-floating-audio-playlist-header">播放列表</div>' +
            '<div class="chat-floating-audio-playlist-list"></div>' +
            '</div>' +
            '</div>';
        document.body.appendChild(floatingAudioPlayer);

        var playBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-play-btn');
        var closeBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-close');
        var prevBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-prev-btn');
        var nextBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-next-btn');
        var loopBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-loop-btn');
        var speedBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-speed-btn');
        var lyricsBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-lyrics-btn');
        var listBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-list-btn');
        var progressBar = floatingAudioPlayer.querySelector('.chat-floating-audio-progress-bar');

        if (prevBtn) prevBtn.addEventListener('click', function (e) { e.stopPropagation(); goPrevTrack(); });
        if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); goNextTrack(); });
        if (loopBtn) {
            loopBtn.addEventListener('click', function (e) { e.stopPropagation(); cycleLoopMode(); });
        }
        if (speedBtn) {
            speedBtn.addEventListener('click', function (e) { e.stopPropagation(); cyclePlaybackSpeed(); });
        }
        if (lyricsBtn) lyricsBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleLyricsPanel();
        });

        // 绑定歌词控制栏缩放按键事件
        var zoomOutBtn = floatingAudioPlayer.querySelector('.lyrics-zoom-out');
        var zoomInBtn = floatingAudioPlayer.querySelector('.lyrics-zoom-in');
        var currentLyricsFontSize = 1.15;
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (currentLyricsFontSize > 0.85) {
                    currentLyricsFontSize -= 0.1;
                    document.documentElement.style.setProperty('--lyrics-font-size', currentLyricsFontSize.toFixed(2) + 'rem');
                }
            });
        }
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (currentLyricsFontSize < 2.05) {
                    currentLyricsFontSize += 0.1;
                    document.documentElement.style.setProperty('--lyrics-font-size', currentLyricsFontSize.toFixed(2) + 'rem');
                }
            });
        }

        // 绑定滚动时的全局虚化遮蔽与节流保护
        var lyricsBody = floatingAudioPlayer.querySelector('.chat-floating-audio-lyrics-body');
        if (lyricsBody) {
            var scrollTimeout;
            lyricsBody.addEventListener('scroll', function() {
                // 如果是播放引擎自动追踪抛出的滚动，不要去掉系统的景深滤镜
                if (window._isAutoScrollingLyrics) return; 
                
                lyricsBody.classList.add('is-scrolling');
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(function() {
                    lyricsBody.classList.remove('is-scrolling');
                }, 1000);
            });
        }

        if (listBtn) listBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            // 关闭歌词面板
            closeLyricsPanel();
            playlistPanelEl = document.getElementById('chatFloatingPlaylistPanel');
            if (playlistPanelEl) {
                var visible = playlistPanelEl.classList.contains('is-open');
                if (visible) {
                    playlistPanelEl.classList.remove('is-open');
                    playlistPanelEl.setAttribute('aria-hidden', 'true');
                } else {
                    renderPlaylistPanel();
                    playlistPanelEl.classList.add('is-open');
                    playlistPanelEl.setAttribute('aria-hidden', 'false');
                }
            }
        });

        var minimizeBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-minimize-btn');
        var expandBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-expand-btn');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (playlistPanelEl && playlistPanelEl.classList.contains('is-open')) {
                    playlistPanelEl.classList.remove('is-open');
                    playlistPanelEl.setAttribute('aria-hidden', 'true');
                }
                floatingPlayerMiniMode = true;
                floatingAudioPlayer.classList.add('is-mini-shrinking');

                // Delay layout change for smooth transition
                setTimeout(function () {
                    floatingAudioPlayer.classList.add('is-mini');
                    floatingAudioPlayer.classList.remove('is-mini-shrinking');
                    updateFloatingAudioTitleFormat();
                    requestAnimationFrame(function () { updateFloatingAudioPlayer(); });
                }, 250); // Adjusted for transition
            });
        }
        if (expandBtn) {
            expandBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                floatingPlayerMiniMode = false;

                updateFloatingAudioTitleFormat();

                floatingAudioPlayer.classList.remove('is-mini-shrinking');
                floatingAudioPlayer.classList.remove('is-mini');
                floatingAudioPlayer.classList.add('is-expanding');
                // Delay showing progress/buttons until container has expanded
                setTimeout(function () {
                    floatingAudioPlayer.classList.remove('is-expanding');
                    requestAnimationFrame(function () { updateFloatingAudioPlayer(); });
                }, 600); // 0.6s transition match
            });
        }

        if (playBtn) {
            playBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (currentFloatingAudio) {
                    if (currentFloatingAudio.paused) {
                        currentFloatingAudio.play().then(function () {
                            updateFloatingAudioPlayer();
                        }).catch(function (err) { console.error('播放失败:', err); });
                    } else {
                        currentFloatingAudio.pause();
                        updateFloatingAudioPlayer();
                    }
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (currentFloatingAudio) {
                    currentFloatingAudio.pause();
                    currentFloatingAudio.currentTime = 0;
                }
                hideFloatingAudioPlayer();
            });
        }

        if (progressBar) {
            var handleStart = function (e) {
                if (e.type === 'touchstart') {
                    // Don't preventDefault here to allow clicks, but might need it for touch control
                } else {
                    e.preventDefault();
                }
                if (!currentFloatingAudio || !currentFloatingAudio.duration) return;
                isDraggingFloatingProgress = true;
                floatingProgressDidMove = false;

                var clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
                floatingProgressDownX = clientX;
                floatingProgressDownTime = Date.now();

                wasPlayingBeforeDrag = !currentFloatingAudio.paused;
                if (wasPlayingBeforeDrag) {
                    currentFloatingAudio.pause();
                }

                var rect = progressBar.getBoundingClientRect();
                floatingProgressClickPercent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                // 记录拖动开始时的音频当前时间，作为计算基准
                window.floatingProgressStartTime = currentFloatingAudio.currentTime;
                lastDragPercent = floatingProgressClickPercent;

                // Add visual feedback
                var wrap = progressBar.closest('.chat-floating-audio-progress-wrap');
                if (wrap) wrap.classList.add('is-dragging');
            };

            progressBar.addEventListener('mousedown', handleStart);
            progressBar.addEventListener('touchstart', handleStart, { passive: false });
        }

        if (!window._chatFloatingProgressDragListeners) {
            window._chatFloatingProgressDragListeners = true;

            var handleMove = function (e) {
                if (!isDraggingFloatingProgress || !currentFloatingAudio || !currentFloatingAudio.duration) return;

                var clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;

                if (!floatingProgressDidMove && Math.abs(clientX - floatingProgressDownX) > FLOATING_PROGRESS_MOVE_THRESHOLD_PX) {
                    floatingProgressDidMove = true;
                    lastDragPercent = floatingProgressClickPercent;
                }

                if (!floatingProgressDidMove) return;

                // Prevent scrolling on mobile during drag
                if (e.type === 'touchmove') e.preventDefault();

                // 核心手感算法：实现“点击不跳，拖动跟随”
                var bar = document.querySelector('.chat-floating-audio-progress-bar');
                if (!bar) return;
                var rect = bar.getBoundingClientRect();
                var percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                var duration = currentFloatingAudio.duration;

                // 算法：newTime = PressTime + (CurrentPercent - PressPercent) * Duration
                var deltaPercent = percent - floatingProgressClickPercent;
                var newTime = (window.floatingProgressStartTime || 0) + deltaPercent * duration;

                newTime = Math.max(0, Math.min(duration, newTime));
                currentFloatingAudio.currentTime = newTime;
                lastDragPercent = percent;

                // 立即更新 UI，使反馈更灵敏
                updateFloatingAudioPlayer();
            };

            var handleEnd = function (e) {
                if (isDraggingFloatingProgress && currentFloatingAudio && currentFloatingAudio.duration) {
                    if (!floatingProgressDidMove && (Date.now() - floatingProgressDownTime) < FLOATING_PROGRESS_SHORT_PRESS_MS) {
                        currentFloatingAudio.currentTime = floatingProgressClickPercent * currentFloatingAudio.duration;
                    }
                    if (wasPlayingBeforeDrag) {
                        currentFloatingAudio.play().catch(function (e) { console.error('Resume failed:', e) });
                    }
                    updateFloatingAudioPlayer();
                }
                isDraggingFloatingProgress = false;
                wasPlayingBeforeDrag = false;

                // Remove visual feedback
                var wrap = document.querySelector('.chat-floating-audio-progress-wrap');
                if (wrap) wrap.classList.remove('is-dragging');
            };

            document.addEventListener('mousemove', handleMove);
            document.addEventListener('touchmove', handleMove, { passive: false });
            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchend', handleEnd);
        }

        // Container click to expand (Mobile/Desktop Mini Mode)
        floatingAudioPlayer.addEventListener('click', function (e) {
            // If dragging progress, don't expand
            if (isDraggingFloatingProgress) return;

            // Only expand if in mini mode
            if (floatingPlayerMiniMode) {
                floatingPlayerMiniMode = false;
                updateFloatingAudioTitleFormat();

                floatingAudioPlayer.classList.remove('is-mini-shrinking');
                floatingAudioPlayer.classList.remove('is-mini');
                floatingAudioPlayer.classList.add('is-expanding');

                setTimeout(function () {
                    floatingAudioPlayer.classList.remove('is-expanding');
                    requestAnimationFrame(function () { updateFloatingAudioPlayer(); });
                }, 600);
            }
        });

        return floatingAudioPlayer;
    }

    function showFloatingAudioPlayer(audio, audioWrap, trackInfo) {
        var player = ensureFloatingAudioPlayer();
        if (!player) return;

        if (!document.body.contains(player)) {
            document.body.appendChild(player);
        }

        if (currentFloatingAudio && currentFloatingAudio !== audio && !currentFloatingAudio.paused) {
            currentFloatingAudio.pause();
            currentFloatingAudio.currentTime = 0;
        }

        currentFloatingAudio = audio;
        var isAlreadyVisible = player.classList.contains('is-visible');
        player.classList.add('is-visible');

        // Mobile default to mini mode (Only apply when first showing or if mode not explicitly set)
        if (window.innerWidth <= 768 && !isAlreadyVisible) {
            floatingPlayerMiniMode = true;
            player.classList.add('is-mini');
            updateFloatingAudioTitleFormat();
        }

        if (audioWrap) {
            var msgRow = audioWrap.closest('.chat-message-item');
            var fileRow = audioWrap.closest('.chat-file-list-item');
            if (msgRow && msgRow.dataset.msgId) {
                audio.dataset.playingMessageId = msgRow.dataset.msgId;
                if (audioWrap.dataset.audioUrl) audio.dataset.playingAudioUrl = audioWrap.dataset.audioUrl;
                if (audioWrap.dataset.audioName) audio.dataset.playingAudioName = audioWrap.dataset.audioName || '';
            } else if (fileRow && fileRow.dataset.msgId) {
                audio.dataset.playingMessageId = fileRow.dataset.msgId;
                if (audioWrap.dataset.audioUrl) audio.dataset.playingAudioUrl = audioWrap.dataset.audioUrl;
                if (audioWrap.dataset.audioName) audio.dataset.playingAudioName = audioWrap.dataset.audioName || '';
            }
        }

        if (floatingPlayerUpdateInterval) clearInterval(floatingPlayerUpdateInterval);
        floatingPlayerUpdateInterval = setInterval(function () {
            if (currentFloatingAudio && currentFloatingAudio === audio) {
                if (!audio.paused) updateFloatingAudioPlayer();
                if (audio.ended || currentFloatingAudio !== audio) {
                    clearInterval(floatingPlayerUpdateInterval);
                    floatingPlayerUpdateInterval = null;
                }
            } else {
                clearInterval(floatingPlayerUpdateInterval);
                floatingPlayerUpdateInterval = null;
            }
        }, 50);

        var titleEl = player.querySelector('.chat-floating-audio-title');
        var artistEl = player.querySelector('.chat-floating-audio-artist');
        var coverImg = player.querySelector('.chat-floating-audio-cover');
        var iconDefault = player.querySelector('.chat-floating-audio-icon-default');

        var audioNameWithoutExt;
        var senderName;
        var albumCoverUrl = null;

        if (audioWrap) {
            var audioTitle = (audioWrap.dataset.audioTitle && audioWrap.dataset.audioTitle.trim()) ? audioWrap.dataset.audioTitle.trim() : '';
            var audioArtist = (audioWrap.dataset.audioArtist && audioWrap.dataset.audioArtist.trim()) ? audioWrap.dataset.audioArtist.trim() : '';
            var audioName = audioWrap.dataset.audioName || '音频';
            audioNameWithoutExt = audioTitle || getAudioNameWithoutExt(audioName);
            if (audioWrap.dataset && audioWrap.dataset.albumCover) albumCoverUrl = audioWrap.dataset.albumCover;

            var messageItem = audioWrap.closest('.chat-message-item');
            if (messageItem) {
                var nameEl = messageItem.querySelector('.chat-message-name');
                senderName = audioArtist || (nameEl ? nameEl.textContent.trim() : '');
            } else {
                var fileCard = audioWrap.closest('.chat-file-list-item');
                if (fileCard) {
                    var sourceEl = fileCard.querySelector('.chat-file-source');
                    if (sourceEl) {
                        var sourceText = sourceEl.textContent.trim();
                        var parts = sourceText.split(' · ');
                        senderName = audioArtist || (parts.length > 1 ? parts[1] : (parts[0] || ''));
                    } else senderName = audioArtist || '';
                } else senderName = audioArtist || '';
            }
        } else if (trackInfo) {
            audioNameWithoutExt = trackInfo.audioName || '未播放';
            senderName = (trackInfo.artist != null && trackInfo.artist !== '') ? trackInfo.artist : (trackInfo.senderName || '聊天消息');
            albumCoverUrl = trackInfo.albumCover || null;
        } else {
            // 恢复播放或参数缺失时，优先使用缓存的元数据，避免重置为“未播放”
            audioNameWithoutExt = cachedAudioName || '未播放';
            senderName = cachedArtistName || 'KISO Chat';
            albumCoverUrl = cachedAlbumCover;
        }

        if (albumCoverUrl && coverImg && iconDefault) {
            coverImg.crossOrigin = "Anonymous";
            coverImg.src = albumCoverUrl;
            coverImg.style.display = 'block';
            iconDefault.style.display = 'none';

            coverImg.onload = function () {
                updatePlayerThemeColor(coverImg, player);
            };

            coverImg.onerror = function () {
                coverImg.style.display = 'none';
                iconDefault.style.display = 'flex';
                resetPlayerThemeColor(player);
            };
        } else if (coverImg && iconDefault) {
            coverImg.style.display = 'none';
            iconDefault.style.display = 'flex';
            resetPlayerThemeColor(player);
        }

        // Cache metadata for mode switching
        cachedAudioName = audioNameWithoutExt;
        cachedArtistName = senderName || '聊天消息';
        cachedAlbumCover = albumCoverUrl;

        // Update title and artist separately
        if (titleEl) titleEl.textContent = audioNameWithoutExt;
        if (artistEl) artistEl.textContent = senderName || '聊天消息';

        // Add class to container if artist exists, for CSS separator
        var scrollInner = player.querySelector('.chat-floating-audio-title-scroll-inner');
        if (scrollInner) {
            if (senderName && senderName !== '聊天消息') {
                scrollInner.classList.add('has-artist');
            } else {
                scrollInner.classList.remove('has-artist');
            }
        }

        // Sync overflow logic
        syncFloatingAudioTitleScrollOverflow(player);

        // 确保主动触发系统元数据同步
        initMediaSessionHandlers(audio, audioWrap);
        updateMediaSession(audio, audioWrap);

        updateFloatingAudioPlayer();
    }

    function updateFloatingAudioTitleFormat() {
        if (!floatingAudioPlayer) return;

        var titleEl = floatingAudioPlayer.querySelector('.chat-floating-audio-title');
        var artistEl = floatingAudioPlayer.querySelector('.chat-floating-audio-artist');
        if (!titleEl) return;

        // Use cached metadata
        var audioNameWithoutExt = cachedAudioName;
        var senderName = cachedArtistName;

        // Update title based on mode
        // Update title and artist separately
        if (titleEl) titleEl.textContent = audioNameWithoutExt;
        if (artistEl) artistEl.textContent = senderName || '聊天消息';

        // Add class to container if artist exists, for CSS separator
        var scrollInner = floatingAudioPlayer.querySelector('.chat-floating-audio-title-scroll-inner');
        if (scrollInner) {
            if (senderName && senderName !== '聊天消息') {
                scrollInner.classList.add('has-artist');
            } else {
                scrollInner.classList.remove('has-artist');
            }
        }

        // Sync overflow logic (handles cleanup for normal mode too)
        syncFloatingAudioTitleScrollOverflow(floatingAudioPlayer);
    }

    function hideFloatingAudioPlayer() {
        if (floatingAudioPlayer) {
            floatingAudioPlayer.classList.remove('is-visible');
        }
        if (floatingPlayerUpdateInterval) {
            clearInterval(floatingPlayerUpdateInterval);
            floatingPlayerUpdateInterval = null;
        }
        currentFloatingAudio = null;
    }

    function syncFloatingAudioTitleScrollOverflow(playerEl) {
        if (!playerEl) return;

        // Only enable marquee in mini mode
        if (!floatingPlayerMiniMode) {
            var titleScroll = playerEl.querySelector('.chat-floating-audio-title-scroll');
            if (titleScroll) {
                titleScroll.classList.remove('is-overflowing');
                var titleScrollInner = titleScroll.querySelector('.chat-floating-audio-title-scroll-inner');
                if (titleScrollInner) titleScrollInner.style.animation = 'none';
            }
            return;
        }

        var titleScroll = playerEl.querySelector('.chat-floating-audio-title-scroll');
        var titleScrollInner = titleScroll && titleScroll.querySelector('.chat-floating-audio-title-scroll-inner');
        if (!titleScroll || !titleScrollInner) return;

        console.log('[syncOverflow] scrollWidth:', titleScrollInner.scrollWidth, 'clientWidth:', titleScroll.clientWidth);

        var overflow = titleScrollInner.scrollWidth > titleScroll.clientWidth;
        if (overflow) {
            titleScroll.classList.add('is-overflowing');
            var dx = titleScroll.clientWidth - titleScrollInner.scrollWidth;

            // Calculate timing for constant speed
            // Speed: 30px per second (comfortable reading speed)
            var scrollSpeed = 30;
            var distance = Math.abs(dx);
            var scrollTime = distance / scrollSpeed;
            var pauseTime = 2.0; // 2 seconds pause
            var totalDuration = (scrollTime * 2) + (pauseTime * 2);

            // Calculate percentages for keyframes
            // 0% -> 0
            // p1 -> Left (end of scroll)
            // p2 -> Left (end of pause)
            // p3 -> Right (end of return)
            // 100% -> Right (end of pause)
            var p1 = (scrollTime / totalDuration) * 100;
            var p2 = ((scrollTime + pauseTime) / totalDuration) * 100;
            var p3 = ((scrollTime * 2 + pauseTime) / totalDuration) * 100;

            // Create dynamic keyframes with unique name
            var keyframesName = 'marquee_scroll_dynamic';
            var keyframesCss = `
                @keyframes ${keyframesName} {
                    0% { transform: translateX(0); }
                    ${p1}% { transform: translateX(${dx}px); }
                    ${p2}% { transform: translateX(${dx}px); }
                    ${p3}% { transform: translateX(0); }
                    100% { transform: translateX(0); }
                }
            `;

            // Update or create style element
            var styleId = 'chat-audio-marquee-style';
            var styleEl = document.getElementById(styleId);
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                document.head.appendChild(styleEl);
            }
            styleEl.textContent = keyframesCss;

            // Reset animation to ensure clean start
            titleScrollInner.style.animation = 'none';
            titleScrollInner.offsetHeight; /* trigger reflow */

            // Apply new animation properties
            titleScrollInner.style.animationName = keyframesName;
            titleScrollInner.style.animationDuration = totalDuration + 's';
            titleScrollInner.style.animationTimingFunction = 'linear';
            titleScrollInner.style.animationIterationCount = 'infinite';

            console.log('[syncOverflow] OVERFLOW DETECTED!',
                'dx:', dx,
                'duration:', totalDuration.toFixed(2) + 's',
                'p1:', p1.toFixed(1) + '%',
                'p2:', p2.toFixed(1) + '%',
                'p3:', p3.toFixed(1) + '%'
            );
        } else {
            titleScroll.classList.remove('is-overflowing');
            // Reset animation
            titleScrollInner.style.animation = 'none';
            var styleId = 'chat-audio-marquee-style';
            var styleEl = document.getElementById(styleId);
            if (styleEl) styleEl.textContent = '';

            console.log('[syncOverflow] No overflow');
        }
    }

    function updateFloatingAudioPlayer() {
        if (!floatingAudioPlayer || !currentFloatingAudio || !floatingAudioPlayer.classList.contains('is-visible')) return;

        var audio = currentFloatingAudio;
        var playBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-play-btn');
        var progressFilled = floatingAudioPlayer.querySelector('.chat-floating-audio-progress-filled');
        var timeCurrent = floatingAudioPlayer.querySelector('.chat-floating-audio-time-current');
        var timeTotal = floatingAudioPlayer.querySelector('.chat-floating-audio-time-total');

        if (playBtn) {
            var icon = playBtn.querySelector('i');
            if (icon) icon.className = audio.paused ? 'fas fa-play' : 'fas fa-pause';
        }

        var loopBtn = floatingAudioPlayer.querySelector('.chat-floating-audio-loop-btn');
        if (loopBtn) {
            var loopIconWrap = loopBtn.querySelector('.chat-floating-audio-loop-icon-wrap');
            var loopTitle = audioPlaylistLoopMode === 'list' ? '列表循环' : (audioPlaylistLoopMode === 'single' ? '单曲循环' : '不循环');
            loopBtn.setAttribute('aria-label', loopTitle);
            loopBtn.title = loopTitle;
            loopBtn.classList.remove('is-loop-active', 'is-loop-off', 'is-single');

            if (loopIconWrap) {
                if (audioPlaylistLoopMode === 'none') {
                    loopBtn.classList.add('is-loop-off');
                    loopIconWrap.innerHTML = '<i class="fas fa-ban"></i>';
                } else if (audioPlaylistLoopMode === 'single') {
                    loopBtn.classList.add('is-loop-active', 'is-single');
                    // Custom SVG for Single Loop (Remake) - Two arrows with centered 1
                    loopIconWrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1em;height:1em;overflow:visible;"><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" opacity="0" /><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /><text x="12" y="16.5" font-size="9" fill="currentColor" stroke="none" text-anchor="middle" font-weight="900" style="font-family:ui-sans-serif,system-ui,sans-serif;">1</text></svg>';
                } else {
                    loopBtn.classList.add('is-loop-active');
                    loopIconWrap.innerHTML = '<i class="fas fa-sync-alt"></i>';
                }
            }
        }



        var duration = audio.duration;
        var currentTime = audio.currentTime || 0;

        if (duration && isFinite(duration) && duration > 0) {
            var percent = Math.max(0, Math.min(100, (currentTime / duration) * 100));
            if (progressFilled) {
                progressFilled.style.width = percent + '%';
                if (percent > 0) progressFilled.classList.add('has-progress'); else progressFilled.classList.remove('has-progress');
            }
            if (timeCurrent) timeCurrent.textContent = formatAudioTime(currentTime);
            if (timeTotal) timeTotal.textContent = formatAudioTime(duration);
        } else {
            if (progressFilled) {
                progressFilled.style.width = '0%';
                progressFilled.classList.remove('has-progress');
            }
            if (timeCurrent) timeCurrent.textContent = '00:00';
            if (timeTotal) timeTotal.textContent = (duration && isFinite(duration) && duration > 0) ? formatAudioTime(duration) : '--:--';
        }

        // ── 歌词同步 ──
        syncLyricsHighlight(currentTime);
    }

    function updateMediaSession(audio, audioWrap) {
        if (!('mediaSession' in navigator)) return;
        try {
            var audioName = cachedAudioName || '音频';
            var senderName = cachedArtistName || '聊天消息';
            var albumCoverUrl = null;
            var avatarUrl = '';

            // 如果有 audioWrap (来自消息卡片点击)，尝试获取更精细的信息
            if (audioWrap) {
                audioName = audioWrap.dataset.audioName || audioName;
                var messageItem = audioWrap.closest('.chat-message-item');
                if (messageItem) {
                    var nameEl = messageItem.querySelector('.chat-message-name');
                    if (nameEl) senderName = nameEl.textContent.trim();
                    var avatarEl = messageItem.querySelector('.chat-message-avatar-img');
                    if (avatarEl) avatarUrl = avatarEl.src || '';
                } else {
                    var fileCard = audioWrap.closest('.chat-file-list-item');
                    if (fileCard) {
                        var sourceEl = fileCard.querySelector('.chat-file-source');
                        if (sourceEl) {
                            var sourceText = sourceEl.textContent.trim();
                            var parts = sourceText.split(' · ');
                            senderName = parts.length > 1 ? parts[1] : (parts[0] || '');
                        }
                    }
                }
                if (audioWrap.dataset && audioWrap.dataset.albumCover) {
                    albumCoverUrl = audioWrap.dataset.albumCover;
                }
            } else {
                albumCoverUrl = cachedAlbumCover; // Use cached album cover if audioWrap is not provided
            }

            // Tauri Android 适配：同步到原生 MediaSession
            if (window.__TAURI__ && window.__TAURI__.core) {
                window.__TAURI__.core.invoke("update_android_media_session", {
                    title: audioName,
                    artist: senderName,
                    isPlaying: !audio.paused
                }).catch(err => console.error('[Tauri MediaSession] Sync Failed:', err));
            }

            // 封面优先级：显式专辑封面 > 缓存封面(如果有) > 用户头像
            var finalArtwork = [];
            if (albumCoverUrl) {
                var absCoverUrl = toAbsoluteUrl(albumCoverUrl);
                // 安卓通知栏更喜欢多种尺寸的 artwork 定义，即使是同一个 URL
                var sizes = ['96x96', '128x128', '192x192', '256x256', '384x384', '512x512'];
                sizes.forEach(function (s) {
                    finalArtwork.push({ src: absCoverUrl, sizes: s, type: 'image/jpeg' });
                    finalArtwork.push({ src: absCoverUrl, sizes: s, type: 'image/png' }); // 容错
                });
            } else if (avatarUrl) {
                var absAvatarUrl = toAbsoluteUrl(avatarUrl);
                finalArtwork.push({ src: absAvatarUrl, sizes: '96x96', type: 'image/png' });
            }

            var metadata = {
                title: audioName,
                artist: senderName,
                album: 'KISO Chat'
            };
            if (finalArtwork.length > 0) metadata.artwork = finalArtwork;

            navigator.mediaSession.metadata = new MediaMetadata(metadata);

            // 更新播放进度状态
            if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
                mediaSessionPositionState = {
                    duration: audio.duration,
                    playbackRate: audio.playbackRate || 1.0,
                    position: audio.currentTime || 0
                };
                navigator.mediaSession.setPositionState(mediaSessionPositionState);
            }

            // 同步播放状态，确保系统按钮（播放/暂停）即时响应
            navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
        } catch (e) {
            console.warn('[MediaSession] 元数据同步失败:', e);
        }
    }

    function initMediaSessionHandlers(audio, audioWrap) {
        if (!('mediaSession' in navigator)) return;
        try {
            navigator.mediaSession.setActionHandler('play', function () {
                if (audio.paused) {
                    audio.play().catch(function (err) { console.error('播放失败:', err); });
                }
            });
            navigator.mediaSession.setActionHandler('pause', function () {
                if (!audio.paused) {
                    audio.pause();
                }
            });
            navigator.mediaSession.setActionHandler('seekto', function (details) {
                if (details.seekTime !== undefined) {
                    audio.currentTime = details.seekTime;
                    if (mediaSessionPositionState) {
                        mediaSessionPositionState.position = details.seekTime;
                        navigator.mediaSession.setPositionState(mediaSessionPositionState);
                    }
                }
            });
            navigator.mediaSession.setActionHandler('previoustrack', function () {
                goPrevTrack();
            });
            navigator.mediaSession.setActionHandler('nexttrack', function () {
                goNextTrack();
            });
            // 安卓端常用的快进快退逻辑
            navigator.mediaSession.setActionHandler('seekbackward', function () {
                audio.currentTime = Math.max(0, audio.currentTime - 10);
                updateMediaSession(audio, audioWrap);
            });
            navigator.mediaSession.setActionHandler('seekforward', function () {
                audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 10);
                updateMediaSession(audio, audioWrap);
            });
            navigator.mediaSession.setActionHandler('stop', function () {
                audio.pause();
                audio.currentTime = 0;
                hideFloatingAudioPlayer();
            });
        } catch (e) {
            console.warn('设置 Media Session 事件处理器失败:', e);
        }
    }

    function handlePlay(audio, audioWrap) {
        pauseAllOtherAudios(audio.id);

        // 更新 inline 按钮状态在 chat.js 中已经有 updatePlayButton 处理（如果是通过 initAudioPlayer 绑定）
        // 但我们需要确保 CSS 类名同步
        if (audioWrap) audioWrap.classList.add('playing');

        currentMediaSessionAudio = audio;
        currentFloatingAudio = audio;

        showFloatingAudioPlayer(audio, audioWrap);
        initMediaSessionHandlers(audio, audioWrap);
        updateMediaSession(audio, audioWrap);
        updateFloatingAudioPlayer();
        requestAnimationFrame(function () {
            if (currentFloatingAudio === audio) updateFloatingAudioPlayer();
        });

        if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            mediaSessionPositionState = {
                duration: audio.duration,
                playbackRate: 1.0,
                position: audio.currentTime || 0
            };
            try {
                if ('mediaSession' in navigator) navigator.mediaSession.setPositionState(mediaSessionPositionState);
            } catch (e) { }
        }
    }

    function handlePause(audio) {
        if (currentFloatingAudio === audio) {
            updateFloatingAudioPlayer();
        }
        // inline 样式由 chat.js 处理（移除 .playing）
    }

    function handleEnded(audio) {
        if (currentFloatingAudio === audio) {
            hideFloatingAudioPlayer();
        }
        if (currentMediaSessionAudio === audio) {
            currentMediaSessionAudio = null;
        }
        if (currentFloatingAudio === audio) {
            currentFloatingAudio = null;
        }
    }

    function handleTimeUpdate(audio, audioWrap) {
        // 更新 MediaSession 位置
        if ('mediaSession' in navigator && mediaSessionPositionState) {
            mediaSessionPositionState.position = audio.currentTime || 0;
            try { navigator.mediaSession.setPositionState(mediaSessionPositionState); } catch (e) { }
        }

        if (currentFloatingAudio === audio) {
            updateFloatingAudioPlayer();
        } else if (!audio.paused) {
            // 自动切换
            if (!currentFloatingAudio || (currentFloatingAudio && currentFloatingAudio.paused)) {
                currentFloatingAudio = audio;
                showFloatingAudioPlayer(audio, audioWrap);
                updateFloatingAudioPlayer();
            }
        }
    }

    function handleLoadedMetadata(audio, audioWrap) {
        updateMediaSession(audio, audioWrap);
        if (currentFloatingAudio === audio || !currentFloatingAudio) {
            updateFloatingAudioPlayer();
        }
    }

    function updatePlayerThemeColor(imgEl, playerEl) {
        try {
            var rgb = getDominantColor(imgEl);
            if (rgb) {
                var r = rgb.r, g = rgb.g, b = rgb.b;

                // Boost saturation if too gray
                var max = Math.max(r, g, b);
                var min = Math.min(r, g, b);
                if (max - min < 20) { // Too gray
                    // Revert to default blue if image is grayscale
                    // Or maybe keep it gray? User wants "theme color".
                    // Let's keep it but ensure visibility?
                    // Actually, let's just use it.
                }

                playerEl.style.setProperty('--primary-500', 'rgb(' + r + ',' + g + ',' + b + ')');
                playerEl.style.setProperty('--primary-rgb', r + ',' + g + ',' + b);

                var darker = adjustColorBrightness(r, g, b, -0.1);
                playerEl.style.setProperty('--primary-600', 'rgb(' + darker.r + ',' + darker.g + ',' + darker.b + ')');

                var lighter50 = mixColorWithWhite(r, g, b, 0.95);
                playerEl.style.setProperty('--primary-50', 'rgb(' + lighter50.r + ',' + lighter50.g + ',' + lighter50.b + ')');

                var lighter100 = mixColorWithWhite(r, g, b, 0.9);
                playerEl.style.setProperty('--primary-100', 'rgb(' + lighter100.r + ',' + lighter100.g + ',' + lighter100.b + ')');

                var darkest = adjustColorBrightness(r, g, b, -0.2);
                playerEl.style.setProperty('--primary-700', 'rgb(' + darkest.r + ',' + darkest.g + ',' + darkest.b + ')');
                return;
            }
        } catch (e) {
            console.warn('Theme extraction failed', e);
        }
        resetPlayerThemeColor(playerEl);
    }

    function resetPlayerThemeColor(playerEl) {
        if (!playerEl) return;
        playerEl.style.removeProperty('--primary-500');
        playerEl.style.removeProperty('--primary-rgb');
        playerEl.style.removeProperty('--primary-600');
        playerEl.style.removeProperty('--primary-50');
        playerEl.style.removeProperty('--primary-100');
        playerEl.style.removeProperty('--primary-700');
    }

    function getDominantColor(imgEl) {
        try {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            if (!ctx) return null;
            canvas.width = 50;
            canvas.height = 50;
            ctx.drawImage(imgEl, 0, 0, 50, 50);
            var data = ctx.getImageData(0, 0, 50, 50).data;
            var r = 0, g = 0, b = 0, count = 0;
            for (var i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 128) continue; // Skip transparent
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count++;
            }
            if (count === 0) return null;
            return { r: Math.floor(r / count), g: Math.floor(g / count), b: Math.floor(b / count) };
        } catch (e) {
            return null;
        }
    }

    function adjustColorBrightness(r, g, b, percent) {
        return {
            r: Math.max(0, Math.min(255, Math.floor(r * (1 + percent)))),
            g: Math.max(0, Math.min(255, Math.floor(g * (1 + percent)))),
            b: Math.max(0, Math.min(255, Math.floor(b * (1 + percent))))
        };
    }

    function mixColorWithWhite(r, g, b, amount) {
        return {
            r: Math.floor(r + (255 - r) * amount),
            g: Math.floor(g + (255 - g) * amount),
            b: Math.floor(b + (255 - b) * amount)
        };
    }

    // ══════════════════════════════════════════════
    //  歌词面板管理
    // ══════════════════════════════════════════════

    function toggleLyricsPanel() {
        var panel = document.getElementById('chatFloatingLyricsPanel');
        if (!panel) return;
        // 关闭播放列表
        playlistPanelEl = document.getElementById('chatFloatingPlaylistPanel');
        if (playlistPanelEl && playlistPanelEl.classList.contains('is-open')) {
            playlistPanelEl.classList.remove('is-open');
            playlistPanelEl.setAttribute('aria-hidden', 'true');
        }
        lyricsPanelOpen = !lyricsPanelOpen;
        if (lyricsPanelOpen) {
            panel.classList.add('is-open');
            panel.setAttribute('aria-hidden', 'false');
            // 如果有歌词且有当前行，滚动到当前行
            if (lyricsData && lyricsData.lines.length > 0 && lyricsCurrentLine >= 0) {
                scrollLyricsTo(lyricsCurrentLine, false);
            }
        } else {
            panel.classList.remove('is-open');
            panel.setAttribute('aria-hidden', 'true');
        }
    }

    function closeLyricsPanel() {
        var panel = document.getElementById('chatFloatingLyricsPanel');
        if (panel && lyricsPanelOpen) {
            lyricsPanelOpen = false;
            panel.classList.remove('is-open');
            panel.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * 为当前曲目加载歌词
     * @param {string} audioUrl 音频的流式 URL
     */
    function loadLyricsForTrack(audioUrl) {
        if (!audioUrl || lyricsLoadedUrl === audioUrl) return;
        lyricsLoadedUrl = audioUrl;
        lyricsData = null;
        lyricsCurrentLine = -1;

        // 从 /api/music/stream/xxx 中提取文件路径
        var prefix = '/api/music/stream/';
        var idx = audioUrl.indexOf(prefix);
        if (idx === -1) {
            // 非音乐库文件（如聊天音频），不加载歌词
            renderLyricsBody(null);
            return;
        }
        var filePath = audioUrl.substring(idx + prefix.length);

        var apiUrl = '/api/music/lyrics/' + filePath;
        fetch(apiUrl, { credentials: 'include' })
            .then(function (resp) { return resp.json(); })
            .then(function (data) {
                if (data.success && data.lyrics && window.LyricsParser) {
                    lyricsData = window.LyricsParser.parse(data.lyrics);
                    renderLyricsBody(lyricsData);
                } else {
                    lyricsData = null;
                    renderLyricsBody(null);
                }
            })
            .catch(function () {
                lyricsData = null;
                renderLyricsBody(null);
            });
    }

    function renderLyricsBody(data) {
        var panel = document.getElementById('chatFloatingLyricsPanel');
        if (!panel) return;
        var body = panel.querySelector('.chat-floating-audio-lyrics-body');
        if (!body) return;

        if (!data || !data.lines || data.lines.length === 0) {
            body.innerHTML = '<div class="chat-floating-audio-lyrics-empty">暂无歌词</div>';
            return;
        }

        var html = '';
        var PRELUDE_THRESHOLD = 8.0;

        data.lines.forEach(function (line, i) {
            var gap = 0;
            if (i === 0) {
                gap = line.time;
            } else {
                var prevLine = data.lines[i-1];
                var prevDur = (prevLine.syllables && prevLine.syllables.length) ? 
                    Math.max(2.0, prevLine.syllables[prevLine.syllables.length-1].time - prevLine.time + 1.5) : 3.0;
                gap = line.time - (prevLine.time + prevDur);
            }

            if (gap >= PRELUDE_THRESHOLD) {
                html += '<div class="lyrics-interlude-dots" data-target-index="' + i + '">' +
                        '<span class="dot"></span><span class="dot"></span><span class="dot"></span>' +
                        '</div>';
            }

            var syllablesHtml = '';
            var syllables = line.syllables || [{time: line.time, text: line.text}];
            
            var globalCharIdx = 0;
            syllables.forEach(function(s, sIdx) {
                var chars = Array.from(s.text);
                chars.forEach(function(char) {
                    // 录入 data-sid (音节 ID)，以便 CSS/JS 实现群组同步抬升
                    syllablesHtml += '<span class="lyric-char" data-cidx="' + globalCharIdx + '" data-sid="' + sIdx + '">' + escapeHtml(char) + '</span>';
                    globalCharIdx++;
                });
            });

            var mainText = '<span class="lyrics-line-text">' + syllablesHtml + '</span>';
            var translationText = line.translation ? 
                '<span class="lyrics-line-translation">' + escapeHtml(line.translation) + '</span>' : '';
            
            html += '<div class="lyrics-line" data-index="' + i + '">' +
                   mainText + translationText +
                   '</div>';
        });
        
        body.innerHTML = '<div class="lyrics-spacer"></div>' + html + '<div class="lyrics-spacer"></div>';

        if (data.hasTimestamps) {
            body.querySelectorAll('.lyrics-line').forEach(function (el) {
                el.addEventListener('click', function () {
                    var lineIndex = parseInt(el.dataset.index, 10);
                    if (currentFloatingAudio && data.lines[lineIndex] && data.lines[lineIndex].time >= 0) {
                        currentFloatingAudio.currentTime = data.lines[lineIndex].time;
                        if (currentFloatingAudio.paused) {
                            currentFloatingAudio.play().catch(function () {});
                        }
                    }
                });
            });
        }
    }

    var lyricsCurrentLineId = null;

    function syncLyricsHighlight(currentTime) {
        if (!lyricsData || !lyricsData.lines || !lyricsData.lines.length) return;

        var newIndex = window.LyricsParser.findCurrentLine(lyricsData.lines, currentTime);
        
        // 实时更新当前行的进度
        if (newIndex !== -1) {
            updateLineProgress(newIndex, currentTime);
        }

        var inInterlude = false;
        var targetInterludeIndex = -1;
        var INTERLUDE_PRE_START = 0.0; // 彻底移除 0.8s 延迟，实现完美无缝衔接

        if (newIndex !== -1) {
            var currLine = lyricsData.lines[newIndex];
            var lineEnd = currLine.time + 3.0; // 默认给3秒兜底
            
            if (currLine.syllables && currLine.syllables.length > 0) {
                var lastSyllable = currLine.syllables[currLine.syllables.length - 1];
                if (lastSyllable.text === '') {
                    // 如果存在明确的尾部空标签，将其直接用作精确的结束时间
                    lineEnd = lastSyllable.time;
                } else {
                    // 没有明确结束时间的卡拉OK歌词，基于最后一个音节预估结束
                    lineEnd = Math.max(currLine.time + 2.0, lastSyllable.time + 1.5);
                }
            }
            
            if (currentTime > lineEnd && (newIndex + 1 < lyricsData.lines.length)) {
                var nextTime = lyricsData.lines[newIndex+1].time;
                // 如果距离下一句开始还有超过 2 秒，且间隙很大，则显示圆点
                if ((nextTime - lineEnd) >= 8.0 && currentTime > lineEnd + 1.0 && currentTime < nextTime - INTERLUDE_PRE_START) {
                    inInterlude = true;
                    targetInterludeIndex = newIndex + 1;
                } else if (currentTime >= nextTime - INTERLUDE_PRE_START) {
                    // 提前 2 秒就将焦点切换到下一行
                    newIndex = newIndex + 1;
                }
            }
        } else if (currentTime < (lyricsData.lines[0] ? lyricsData.lines[0].time : 0)) {
            var firstTime = lyricsData.lines[0] ? lyricsData.lines[0].time : 0;
            if (lyricsData.lines.length > 0 && firstTime >= 8.0 && currentTime > 1.0 && currentTime < firstTime - INTERLUDE_PRE_START) {
                inInterlude = true;
                targetInterludeIndex = 0;
            } else if (currentTime >= firstTime - INTERLUDE_PRE_START) {
                newIndex = 0;
            }
        }

        var activeId = inInterlude ? 'interlude-' + targetInterludeIndex : 'line-' + newIndex;

        if (activeId !== lyricsCurrentLineId) {
            lyricsCurrentLineId = activeId;
            lyricsCurrentLine = newIndex;

            var panel = document.getElementById('chatFloatingLyricsPanel');
            if (!panel) return;
            var body = panel.querySelector('.chat-floating-audio-lyrics-body');
            if (!body) return;

            // Remove all states
            var allLines = Array.from(body.querySelectorAll('.lyrics-line'));
            allLines.forEach(function(el, idx) {
                el.classList.remove('is-active', 'is-active-upcoming', 'depth-1', 'depth-2', 'depth-3', 'depth-past');
                el.style.removeProperty('--lyric-fill-percent');
                
                // 状态轨迹同步修复：确保“已唱完”的行永远保持抬起和全亮，“未唱”的行恢复原位
                var isPast = false;
                if (inInterlude) {
                    isPast = (idx < targetInterludeIndex);
                } else {
                    isPast = (idx < newIndex && newIndex !== -1);
                }

                if (isPast) {
                    // 过去行：强制全满 + 抬升
                    el.querySelectorAll('.lyric-char').forEach(function(c) {
                        c.style.setProperty('--char-fill', '100%');
                        c.setAttribute('data-active-s', 'true');
                        c.dataset.fill = '100';
                    });
                } else if (newIndex !== -1 && idx > newIndex) {
                    // 未来行（且不是间奏目标）：清空进度 + 归位
                    el.querySelectorAll('.lyric-char').forEach(function(c) {
                        c.style.setProperty('--char-fill', '0%');
                        c.removeAttribute('data-active-s');
                        c.dataset.fill = '0';
                    });
                } else if (newIndex === -1 && !inInterlude) {
                    // 彻底停止或重置状态
                    el.querySelectorAll('.lyric-char').forEach(function(c) {
                        c.style.setProperty('--char-fill', '0%');
                        c.removeAttribute('data-active-s');
                        c.dataset.fill = '0';
                    });
                }
            });
        // [品控增强]：间奏点状态分发（采用差量更新，防止 RAF 每一帧重置导致动画中断）
        body.querySelectorAll('.lyrics-interlude-dots').forEach(function(el) {
            var targetIdx = parseInt(el.dataset.targetIndex || -1, 10);
            var shouldBeActive = false;
            var shouldBeExiting = false;
            var shouldBePast = false;

            if (targetIdx !== -1 && lyricsData.lines[targetIdx]) {
                var targetTime = lyricsData.lines[targetIdx].time;
                var EXIT_DUR = 0.4;
                
                if (inInterlude && targetIdx === targetInterludeIndex) {
                    if (currentTime >= targetTime - EXIT_DUR) {
                        shouldBeExiting = true;
                    } else {
                        shouldBeActive = true;
                    }
                } else if (currentTime >= targetTime) {
                    shouldBePast = true;
                }
            }

            // 执行差量类名操作，确保 transition 正常运行
            if (shouldBeActive) {
                if (!el.classList.contains('is-active')) el.classList.add('is-active');
                el.classList.remove('is-exiting', 'is-past');
            } else if (shouldBeExiting) {
                if (!el.classList.contains('is-exiting')) el.classList.add('is-exiting');
                el.classList.remove('is-active', 'is-past');
            } else if (shouldBePast) {
                // 当由 exiting 刚刚转为 past 时，意味着高度塌陷 (0.6s) 开始。
                // 此时立即启动一个追踪器，在接下来的一段时间内持续“重对焦”当前歌词
                var justEnteredPast = !el.classList.contains('is-past');
                if (justEnteredPast) {
                    el.classList.add('is-past');
                    
                    // 启动 600ms (匹配 CSS 塌陷过渡时间) 的反冲补偿
                    var collapseStartTime = performance.now();
                    var trackerFn = function(now) {
                        if (now - collapseStartTime < 650) { // 多给 50ms 缓冲防尾切
                            var currentActive = body.querySelector('.lyrics-line.is-active, .lyrics-line.is-active-upcoming');
                            if (currentActive) {
                                // 以 bypass 动画的模式，实时硬更新滚动极光
                                scrollLyricsToElement(currentActive, false, true); 
                            }
                            window._interludeCollapseTracker = requestAnimationFrame(trackerFn);
                        } else {
                            cancelAnimationFrame(window._interludeCollapseTracker);
                        }
                    };
                    cancelAnimationFrame(window._interludeCollapseTracker);
                    window._interludeCollapseTracker = requestAnimationFrame(trackerFn);
                }
                el.classList.remove('is-active', 'is-exiting');
            } else {
                el.classList.remove('is-active', 'is-exiting', 'is-past');
            }
        });

        var targetEl = null;

        if (inInterlude) {
            // 标记即将播放的目标行，提前褪去遮罩视差
            var upcomingLine = body.querySelector('.lyrics-line[data-index="' + targetInterludeIndex + '"]');
            if (upcomingLine) upcomingLine.classList.add('is-active-upcoming');
                
                // Also assign depth relative to the targetInterludeIndex
                allLines.forEach(function(el, idx) {
                    if (idx < targetInterludeIndex) {
                        el.classList.add('depth-past');
                    } else if (idx === targetInterludeIndex) {
                        // idx === targetInterludeIndex carries is-active-upcoming
                    } else if (idx === targetInterludeIndex + 1) {
                        el.classList.add('depth-1');
                    } else if (idx === targetInterludeIndex + 2) {
                        el.classList.add('depth-2');
                    } else {
                        el.classList.add('depth-3');
                    }
                });
            } else if (newIndex !== -1) {
                targetEl = body.querySelector('.lyrics-line[data-index="' + newIndex + '"]');
                if (targetEl) targetEl.classList.add('is-active');
                
                // Assign depth classes
                allLines.forEach(function(el, idx) {
                    if (idx === newIndex) return; // is-active already handles it
                    if (idx < newIndex) {
                        el.classList.add('depth-past');
                    } else {
                        var dist = idx - newIndex;
                        if (dist === 1) el.classList.add('depth-1');
                        else if (dist === 2) el.classList.add('depth-2');
                        else el.classList.add('depth-3');
                    }
                });
            }

            if (targetEl) {
                scrollLyricsToElement(targetEl, true);
            }
        }
    }

    function updateLineProgress(index, currentTime) {
        var line = lyricsData.lines[index];
        if (!line) return;

        var panel = document.getElementById('chatFloatingLyricsPanel');
        var activeLine = panel.querySelector('.lyrics-line[data-index="' + index + '"]');
        if (!activeLine) return;

        var syllables = line.syllables;
        var validTextSyllablesCount = 0;
        if (syllables) {
            for (var i = 0; i < syllables.length; i++) {
                if (syllables[i].text.length > 0) validTextSyllablesCount++;
            }
        }

        // 对于没有任何音节，或只有一个带文字的音节（标准LRC，或仅提供起止时间戳但不提供行内分词的歌词），
        // 我们直接让它整行亮起，不执行卡拉OK式的逐字匀速填充动画。
        if (!syllables || validTextSyllablesCount <= 1) {
            activeLine.querySelectorAll('.lyric-char').forEach(function(c) {
                if (c.dataset.fill !== '100') {
                    c.style.setProperty('--char-fill', '100%');
                    c.dataset.fill = '100';
                }
                if (c.getAttribute('data-active-s') !== 'true') {
                    c.setAttribute('data-active-s', 'true');
                }
            });
            return;
        }

        var sIdx = -1;
        for (var i = 0; i < syllables.length; i++) {
            if (currentTime >= syllables[i].time) sIdx = i;
            else break;
        }

        var globalCharProgress = 0;
        if (sIdx !== -1) {
            var charsBeforeLength = 0;
            for (var j = 0; j < sIdx; j++) charsBeforeLength += Array.from(syllables[j].text).length;
            
            var sChars = Array.from(syllables[sIdx].text).length;
            
            // 修复末尾音节填充过缓：为最后一段音节设定视觉上限 (1.2s)，防止长间奏拉跨
            var DEFAULT_LAST_SYLLABLE_DUR = 1.2;
            var nextT;
            if (sIdx + 1 < syllables.length) {
                nextT = syllables[sIdx+1].time;
            } else {
                var nextLineStart = lyricsData.lines[index+1] ? lyricsData.lines[index+1].time : (line.time + 3);
                // 取“下一行起点”或“当前音节起点+1.2秒”中的最小值，确保哪怕有10秒间奏，最后一个字也会在1.2秒内填完
                nextT = Math.min(syllables[sIdx].time + DEFAULT_LAST_SYLLABLE_DUR, nextLineStart);
            }
            
            var dur = nextT - syllables[sIdx].time;
            var progress = dur > 0 ? Math.min(1, Math.max(0, (currentTime - syllables[sIdx].time) / dur)) : 1;
            
            globalCharProgress = charsBeforeLength + (sChars * progress);
        }

        var chars = activeLine.querySelectorAll('.lyric-char');
        var floorProgress = Math.floor(globalCharProgress);
        
        for (var c = 0; c < chars.length; c++) {
            var charEl = chars[c];
            var charSId = parseInt(charEl.dataset.sid || -1, 10);
            
            // 音节级别的同步抬升：只要该字符所属的音节 ID <= 当前播放的音节 ID，就抬起
            if (charSId !== -1 && charSId <= sIdx) {
                if (charEl.getAttribute('data-active-s') !== 'true') {
                    charEl.setAttribute('data-active-s', 'true');
                }
            } else if (charSId === -1 && c <= floorProgress) {
                // 回退逻辑，针对无音节数据的文本
                charEl.setAttribute('data-active-s', 'true');
            } else {
                if (charEl.getAttribute('data-active-s') === 'true') {
                    charEl.removeAttribute('data-active-s');
                }
            }

            // 字符级别的平滑填充（颜色）
            if (c < floorProgress) {
                if (charEl.dataset.fill !== '100') {
                    charEl.style.setProperty('--char-fill', '100%');
                    charEl.dataset.fill = '100';
                }
            } else if (c === floorProgress) {
                var fill = (globalCharProgress - floorProgress) * 100;
                charEl.style.setProperty('--char-fill', fill.toFixed(1) + '%');
                charEl.dataset.fill = 'partial';
            } else {
                if (charEl.dataset.fill !== '0') {
                    charEl.style.setProperty('--char-fill', '0%');
                    charEl.dataset.fill = '0';
                }
            }
        }
    }

    function scrollLyricsToElement(target, smooth, forceSync) {
        var panel = document.getElementById('chatFloatingLyricsPanel');
        if (!panel) return;
        var body = panel.querySelector('.chat-floating-audio-lyrics-body');
        if (!body || !target) return;

        // 1. 计算物理目标位移：从垂直居中改为靠顶（留出约 60px 的顶部缓冲）
        var TOP_FOCUS_PADDING = 60;
        var targetOffset = target.offsetTop - body.offsetTop - TOP_FOCUS_PADDING;
        if (targetOffset < 0) targetOffset = 0; // 防止越界导致初次动画倒置
        
        // 锁定自动滚动状态 (如果不是强制同步补偿的话)
        if (!forceSync) {
            window._isAutoScrollingLyrics = true;
            clearTimeout(window._autoScrollLyricsTimeout);
        }

        if (!smooth) {
            // 直接赋值 scrollTop，用于静态跳转或高度塌陷的实时强同步补位
            body.scrollTop = targetOffset;
            if (!forceSync) window._isAutoScrollingLyrics = false;
            return;
        }

        var oldScroll = body.scrollTop;
        // 关键修复：修正 Delta 极性。
        // 当滚动条向下移动（targetOffset > oldScroll）时，内容看起来向上跳。
        // 我们需要施加一个正向的 translateY(补偿) 将内容拉回原位，然后弹性释放到 0。
        var delta = targetOffset - oldScroll;
        
        if (Math.abs(delta) < 1) {
            body.scrollTop = targetOffset;
            window._isAutoScrollingLyrics = false;
            return;
        }

        // 2. 状态机重置与单任务原子化渲染
        var allLines = body.querySelectorAll('.lyrics-line, .lyrics-interlude-dots');
        var targetIdxStr = target.dataset.index || target.dataset.targetIndex;
        var targetIdx = parseInt(targetIdxStr || -1, 10);

        // [原子操作：单任务内完成位移对冲]
        // 先设为目标物理位置
        body.scrollTop = targetOffset;
        
        allLines.forEach(function(el) {
            var elRawIdx = el.dataset.index || el.dataset.targetIndex;
            var elIdx = parseInt(elRawIdx || -1, 10);

            // a. 瞬间锁定视觉位置（关闭动画）
            el.style.transition = 'none';
            el.style.transform = 'translateY(' + delta + 'px)';
            
            // b. 强制同步布局 (Reflow)，确保上述 style 立即生效
            el.offsetHeight; 

            // c. 计算梯度延时
            var delay = 0;
            if (elIdx !== targetIdx) {
                var dist = Math.abs(elIdx - targetIdx);
                if (elIdx > targetIdx) {
                    delay = Math.min(0.25, 0.04 + dist * 0.015);
                } else {
                    delay = Math.min(0.15, 0.02 + dist * 0.01);
                }
            }

            // d. 激活平滑回航：移除 Q 弹曲线，改为极简平滑曲线
            el.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.5s ease, filter 0.5s ease';
            el.style.transitionDelay = delay + 's';
            el.style.transform = 'translateY(0)';
        });

        // 3. 锁定状态清理
        window._autoScrollLyricsTimeout = setTimeout(function() {
            window._isAutoScrollingLyrics = false;
            allLines.forEach(function(l) { 
                l.style.transitionDelay = '';
                l.style.transition = ''; 
            });
        }, 800);
    }

    // 在曲目切换时自动加载歌词（Hook 到 playPlaylistTrack）
    var _origPlayPlaylistTrack = playPlaylistTrack;
    playPlaylistTrack = function (index) {
        _origPlayPlaylistTrack(index);
        // 加载歌词
        if (index >= 0 && index < audioPlaylist.length) {
            var track = audioPlaylist[index];
            if (track && track.audioUrl) {
                lyricsLoadedUrl = ''; // 强制重新加载
                loadLyricsForTrack(track.audioUrl);
            }
        }
    };

    // 启用基于 requestAnimationFrame 的高帧率 (60fps) 同步循环
    // 取代浏览器原生 timeupdate (~4Hz) 的低频刷新，丝滑呈现逐字填充效果
    function lyricsRafLoop() {
        if (playlistAudioEl && !playlistAudioEl.paused && lyricsPanelOpen) {
            syncLyricsHighlight(playlistAudioEl.currentTime);

            // 抗漂移保底逻辑：只要当前不在滚动和动画状态，严格锁定播放项在正确位置
            var panel = document.getElementById('chatFloatingLyricsPanel');
            var body = panel ? panel.querySelector('.chat-floating-audio-lyrics-body') : null;
            if (body && !window._isAutoScrollingLyrics && !body.classList.contains('is-scrolling')) {
                var currentActive = body.querySelector('.lyrics-line.is-active');
                if (currentActive) {
                    var targetOffset = currentActive.offsetTop - body.offsetTop - 60;
                    if (targetOffset < 0) targetOffset = 0;
                    // 如果存在超过2px的漂移，平滑回位
                    if (Math.abs(body.scrollTop - targetOffset) > 2) {
                        scrollLyricsToElement(currentActive, true, false);
                    }
                }
            }
        }
        requestAnimationFrame(lyricsRafLoop);
    }
    requestAnimationFrame(lyricsRafLoop);

})();
