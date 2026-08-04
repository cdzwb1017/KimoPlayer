// Pair with 579991, then fetch songs + lyric via raw HTTP using cookies in same agent.
import fs from 'node:fs';
const BASE = 'http://10.166.25.130:8787';
const CODE = '579991';

// Use fetch with credentials / cookie preservation via agent with jar
// In node 18+ fetch doesn't share cookies globally, use a series of fetches on same fetch via Set-Cookie capture.
const jar = new Map(); // domain -> list of cookie strings
function applyCookies(headers) {
  const cookies = [...jar.values()].flat();
  if (cookies.length) headers.set('Cookie', cookies.join('; '));
}
function saveCookies(res) {
  const arr = res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  for (const c of arr) {
    const key = c.split('=')[0];
    jar.set(key, c.split(';')[0]); // save first part key=value
  }
}

const h1 = new Headers({ 'Content-Type': 'application/json' });
applyCookies(h1);
const r1 = await fetch(BASE + '/api/auth', { method: 'POST', body: JSON.stringify({ code: CODE }), headers: h1, redirect: 'manual' });
saveCookies(r1);
console.log('POST /api/auth status=', r1.status, 'body=', await r1.text());
console.log('Jar size=', jar.size);

// Check GET /api/auth
{
  const h = new Headers(); applyCookies(h);
  const r = await fetch(BASE + '/api/auth', { headers: h });
  saveCookies(r);
  console.log('GET /api/auth status=', r.status, 'body=', await r.text());
}

// Get songs
let songsList = [];
{
  const h = new Headers(); applyCookies(h);
  const r = await fetch(BASE + '/api/songs', { headers: h });
  saveCookies(r);
  const txt = await r.text();
  console.log('GET /api/songs status=', r.status, 'len=', txt.length);
  let songs; try { songs = JSON.parse(txt); } catch {}
  if (Array.isArray(songs)) songsList = songs;
  else if (songs && Array.isArray(songs.data)) songsList = songs.data;
  else if (songs && typeof songs === 'object') {
    console.log('songs keys:', Object.keys(songs));
    for (const k of Object.keys(songs)) if (Array.isArray(songs[k])) { songsList = songs[k]; break; }
  }
  console.log('songs list length=', songsList.length);
}
fs.writeFileSync('_lb_songs_sample.json', JSON.stringify(songsList.slice(0, 3), null, 2));

// Get lyric of first song
if (songsList[0]) {
  const first = songsList[0];
  const id = first.audioId ?? first.id;
  console.log('first id=', id, 'title=', first.title);
  const h = new Headers(); applyCookies(h);
  const r = await fetch(BASE + '/api/lyric?id=' + id, { headers: h });
  saveCookies(r);
  const text = await r.text();
  console.log('GET /api/lyric status=', r.status, 'len=', text.length, 'CT=', r.headers.get('content-type'));
  let obj; try { obj = JSON.parse(text); } catch {}
  if (obj) {
    console.log('Keys:', Object.keys(obj));
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === 'string') console.log('  ', k, 'STR len=', v.length, '\\n-preview=', v.slice(0, 800).replace(/\n/g,'\\n'));
      else console.log('  ', k, typeof v, JSON.stringify(v).slice(0, 1000));
    }
  } else {
    console.log('RAW LYRICS (non-JSON, first 4000 chars):');
    console.log(text.slice(0, 4000));
  }
  fs.writeFileSync('_lb_lyric_sample.txt', text);
}
