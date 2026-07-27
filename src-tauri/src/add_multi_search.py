import re

with open('lib.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add search_kuwo_song_ids after search_kuwo_song_id
kuwo_ids_func = '''
/// 搜索酷我音乐所有匹配的歌曲ID（返回所有歌名+艺术家匹配的结果）
#[tauri::command]
async fn search_kuwo_song_ids(keyword: String, local_title: Option<String>, local_artist: Option<String>) -> Result<Vec<u64>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("创建客户端失败: {}", e))?;

    let url = format!(
        "https://kuwo.cn/search/searchMusicBykeyWord?vipver=1&client=kt&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1&issubtitle=1&show_copyright_off=1&pn=0&rn=30&all={}",
        keyword
    );

    let resp = client.get(&url)
        .header("Referer", "https://www.kuwo.cn/")
        .header("Cookie", "kw_token=AFDCMVOU717")
        .header("csrf", "AFDCMVOU717")
        .send().await.map_err(|e| format!("酷我搜索失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("酷我搜索失败: HTTP {}", resp.status()));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| format!("酷我搜索解析失败: {}", e))?;
    let abslist = body.get("abslist").and_then(|a| a.as_array()).ok_or("酷我搜索结果为空")?;

    let exclude_keywords = ["remix", "live", "翻唱", "cover", "伴奏", "karaoke", "inst", "环境音", "bootleg", "dj"];
    let keyword_lower = keyword.to_lowercase();
    let keyword_song_name = keyword.split_whitespace().next().unwrap_or(&keyword).to_lowercase();
    let local_title_lower = local_title.as_ref().map(|t| t.to_lowercase());
    let local_artist_lower = local_artist.as_ref().map(|a| a.to_lowercase());

    let mut matched_ids = Vec::new();

    for item in abslist {
        let name = item.get("SONGNAME").and_then(|n| n.as_str()).unwrap_or("").to_lowercase();
        let album = item.get("ALBUM").and_then(|a| a.as_str()).unwrap_or("").to_lowercase();
        let artist = item.get("ARTIST").and_then(|a| a.as_str()).unwrap_or("").to_lowercase();

        let is_excluded = exclude_keywords.iter().any(|kw| name.contains(kw) || album.contains(kw));
        if is_excluded { continue; }

        let name_matches = if let Some(ref lt) = local_title_lower {
            let clean_name = remove_brackets(&name);
            let clean_local = remove_brackets(lt);
            clean_name == clean_local || name.contains(&clean_local) || clean_local.contains(&clean_name)
        } else {
            name == keyword_song_name || name == keyword_lower || name.contains(&keyword_song_name) || keyword_song_name.contains(&name)
        };

        let artist_matches = if let Some(ref la) = local_artist_lower {
            let clean_artist = normalize_artist(&artist);
            let clean_local_artist = normalize_artist(la);
            clean_artist.contains(&clean_local_artist) || clean_local_artist.contains(&clean_artist)
        } else {
            true
        };

        if name_matches && artist_matches {
            if let Some(musicrid) = item.get("MUSICRID").and_then(|r| r.as_str()) {
                let id_str = musicrid.trim_start_matches("MUSIC_");
                if let Ok(song_id) = id_str.parse::<u64>() {
                    matched_ids.push(song_id);
                }
            }
        }
    }

    eprintln!("[酷我搜索-多版本] 关键词: {}, 匹配: {} 首", keyword, matched_ids.len());
    Ok(matched_ids)
}
'''

# Insert before QQ search function
content = content.replace(
    '/// 搜索QQ音乐歌曲ID（topid）',
    kuwo_ids_func + '/// 搜索QQ音乐歌曲ID（topid）'
)

# 2. Add search_qq_song_ids after search_qq_song_id
qq_ids_func = '''
/// 搜索QQ音乐所有匹配的歌曲ID（返回所有歌名+艺术家匹配的结果）
#[tauri::command]
async fn search_qq_song_ids(keyword: String, local_title: Option<String>, local_artist: Option<String>) -> Result<Vec<u64>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("创建客户端失败: {}", e))?;

    let url = format!(
        "https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w={}&format=json&p=1&n=30&cr=1",
        keyword
    );

    let resp = client.get(&url)
        .header("Referer", "https://y.qq.com/")
        .send().await.map_err(|e| format!("QQ音乐搜索失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("QQ音乐搜索失败: HTTP {}", resp.status()));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| format!("QQ音乐搜索解析失败: {}", e))?;
    let song_list = body.get("data").and_then(|d| d.get("song")).and_then(|s| s.get("list"))
        .and_then(|l| l.as_array()).ok_or("QQ音乐搜索结果为空")?;

    let keyword_lower = keyword.to_lowercase();
    let keyword_song_name = keyword.split_whitespace().next().unwrap_or(&keyword).to_lowercase();
    let local_title_lower = local_title.as_ref().map(|t| t.to_lowercase());
    let local_artist_lower = local_artist.as_ref().map(|a| a.to_lowercase());

    let mut matched_ids = Vec::new();

    for item in song_list {
        let name = item.get("songname").and_then(|n| n.as_str()).unwrap_or("").to_lowercase();
        let singer_arr = item.get("singer").and_then(|s| s.as_array());
        let artist_name = singer_arr.and_then(|arr| arr.first())
            .and_then(|s| s.get("name")).and_then(|n| n.as_str()).unwrap_or("").to_lowercase();

        let name_matches = if let Some(ref lt) = local_title_lower {
            let clean_name = remove_brackets(&name);
            let clean_local = remove_brackets(lt);
            clean_name == clean_local || name.contains(&clean_local) || clean_local.contains(&clean_name)
        } else {
            name == keyword_song_name || name == keyword_lower || name.contains(&keyword_song_name) || keyword_song_name.contains(&name)
        };

        let artist_matches = if let Some(ref la) = local_artist_lower {
            let clean_artist = normalize_artist(&artist_name);
            let clean_local_artist = normalize_artist(la);
            clean_artist.contains(&clean_local_artist) || clean_local_artist.contains(&clean_artist)
        } else {
            true
        };

        if name_matches && artist_matches {
            if let Some(songmid) = item.get("songmid").and_then(|m| m.as_str()) {
                let detail_url = format!(
                    "https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?songmid={}&format=json",
                    songmid
                );
                if let Ok(detail_resp) = client.get(&detail_url)
                    .header("Referer", "https://y.qq.com/")
                    .send().await {
                    if let Ok(detail_body) = detail_resp.json::<serde_json::Value>().await {
                        if let Some(topid) = detail_body.get("data").and_then(|d| d.as_array())
                            .and_then(|arr| arr.first())
                            .and_then(|item| item.get("id")).and_then(|id| id.as_u64()) {
                            matched_ids.push(topid);
                        }
                    }
                }
            }
        }
    }

    eprintln!("[QQ搜索-多版本] 关键词: {}, 匹配: {} 首", keyword, matched_ids.len());
    Ok(matched_ids)
}
'''

content = content.replace(
    '/// 获取歌曲hash（酷狗需要hash才能获取评论）',
    qq_ids_func + '/// 获取歌曲hash（酷狗需要hash才能获取评论）'
)

# 3. Add search_kugou_song_hashes after search_kugou_song_hash
kg_hashes_func = '''
/// 搜索酷狗所有匹配的歌曲hash（返回所有歌名+艺术家匹配的结果）
#[tauri::command]
async fn search_kugou_song_hashes(keyword: String, local_title: Option<String>, local_artist: Option<String>) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("创建客户端失败: {}", e))?;
    let url = format!(
        "http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword={}&page=1&pagesize=30",
        keyword
    );

    let resp = client.get(&url)
        .header("Referer", "https://www.kugou.com/")
        .send().await.map_err(|e| format!("酷狗搜索失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("酷狗搜索失败: HTTP {}", resp.status()));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| format!("酷狗搜索解析失败: {}", e))?;
    let info_list = body.get("data").and_then(|d| d.get("info"))
        .and_then(|i| i.as_array()).ok_or("酷狗搜索结果为空")?;

    let keyword_lower = keyword.to_lowercase();
    let keyword_song_name = keyword.split_whitespace().next().unwrap_or(&keyword).to_lowercase();
    let local_title_lower = local_title.as_ref().map(|t| t.to_lowercase());
    let local_artist_lower = local_artist.as_ref().map(|a| a.to_lowercase());

    let mut matched_hashes = Vec::new();

    for item in info_list {
        let name = item.get("songname").and_then(|n| n.as_str()).unwrap_or("").to_lowercase();
        let singer = item.get("singername").and_then(|s| s.as_str()).unwrap_or("").to_lowercase();

        let name_matches = if let Some(ref lt) = local_title_lower {
            let clean_name = remove_brackets(&name);
            let clean_local = remove_brackets(lt);
            clean_name == clean_local || name.contains(&clean_local) || clean_local.contains(&clean_name)
        } else {
            name == keyword_song_name || name == keyword_lower || name.contains(&keyword_song_name) || keyword_song_name.contains(&name)
        };

        let artist_matches = if let Some(ref la) = local_artist_lower {
            let clean_artist = normalize_artist(&singer);
            let clean_local_artist = normalize_artist(la);
            clean_artist.contains(&clean_local_artist) || clean_local_artist.contains(&clean_artist)
        } else {
            true
        };

        if name_matches && artist_matches {
            if let Some(hash) = item.get("hash").and_then(|h| h.as_str()) {
                matched_hashes.push(hash.to_string());
            }
        }
    }

    eprintln!("[酷狗搜索-多版本] 关键词: {}, 匹配: {} 首", keyword, matched_hashes.len());
    Ok(matched_hashes)
}
'''

content = content.replace(
    '/// 获取酷狗歌曲评论',
    kg_hashes_func + '/// 获取酷狗歌曲评论'
)

with open('lib.rs', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Added 3 multi-search functions.")
