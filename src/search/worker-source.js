export const SEARCH_WORKER_SOURCE = `
    let lyricsCache = new Map();
    let playlist = [];

    self.onmessage = function(e) {
      const { type, data } = e.data;
      if (type === 'init') {
        playlist = data.playlist || [];
      } else if (type === 'update_cache') {
        const { filePath, lines } = data;
        lyricsCache.set(filePath, lines);
      } else if (type === 'clear_cache') {
        lyricsCache.clear();
      } else if (type === 'search') {
        const { query } = data;
        if (!query) {
          self.postMessage({ type: 'search_results', results: { songs: [], albums: [], artists: [], lyrics: [], others: [] }, query });
          return;
        }
        
        const lowerQuery = query.toLowerCase();

        // 1. Search metadata categories
        const matchedSongs = [];
        const matchedAlbums = [];
        const matchedArtists = [];
        const matchedOthers = [];

        playlist.forEach((song) => {
          if (song.title && song.title.toLowerCase().includes(lowerQuery)) {
            matchedSongs.push(song);
          }
          if (song.album && song.album.toLowerCase().includes(lowerQuery)) {
            matchedAlbums.push(song);
          }
          if (song.artist && song.artist.toLowerCase().includes(lowerQuery)) {
            matchedArtists.push(song);
          }

          const genreMatch = song.genre && song.genre.toLowerCase().includes(lowerQuery);
          const yearMatch = song.year && song.year.toString().includes(lowerQuery);
          const composerMatch = song.composer && song.composer.toLowerCase().includes(lowerQuery);
          const lyricistMatch = song.lyricist && song.lyricist.toLowerCase().includes(lowerQuery);
          const commentMatch = song.comment && song.comment.toLowerCase().includes(lowerQuery);

          if (genreMatch || yearMatch || composerMatch || lyricistMatch || commentMatch) {
            let fieldLabel = '';
            if (genreMatch) fieldLabel = "流派: " + song.genre;
            else if (yearMatch) fieldLabel = "年份: " + song.year;
            else if (composerMatch) fieldLabel = "作曲: " + song.composer;
            else if (lyricistMatch) fieldLabel = "作词: " + song.lyricist;
            else if (commentMatch) fieldLabel = "备注: " + song.comment;

            matchedOthers.push({ song, fieldLabel });
          }
        });

        // 2. Search lyrics
        const lyricsMatches = [];
        playlist.forEach((song) => {
          const lines = lyricsCache.get(song.file_path);
          if (!lines) return;

          const matches = [];
          lines.forEach((line) => {
            const textMatch = line.text && line.text.toLowerCase().includes(lowerQuery);
            const transMatch = line.translation && line.translation.toLowerCase().includes(lowerQuery);
            if (textMatch || transMatch) {
              matches.push(line);
            }
          });

          if (matches.length > 0) {
            lyricsMatches.push({ song, matches });
          }
        });

        self.postMessage({
          type: 'search_results',
          results: {
            songs: matchedSongs,
            albums: matchedAlbums,
            artists: matchedArtists,
            lyrics: lyricsMatches,
            others: matchedOthers
          },
          query
        });
      }
    };
  `;
