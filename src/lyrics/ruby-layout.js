/**
 * AMLL Wn(r) 原版：检测一个字/段是否完全由 CJK 统一汉字构成
 */
const RE_AMLL_CJK = /^[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u2e80-\u2eff\uf900-\ufaff]+$/;
function isCJKChar(ch) {
  if (!ch) return false;
  return RE_AMLL_CJK.test(ch);
}

/**
 * 把振假名字符串按「连续汉字段的字数权重」分配到每个汉字
 *  完全照搬 AMLL 的思路：N 个汉字共用整段 romanWord，按字数的权重切分
 *   例：「態度」2字 + ruby「たいど」3字素
 *        → 態：floor(3*1/2)=1 → 'た'
 *        → 度：余下 2 → 'いど'
 */
function distributeRubyToKanji(fullRuby, kanjiCount) {
  const empty = Array.from({ length: kanjiCount }, () => '');
  if (!fullRuby || kanjiCount <= 0) return empty;
  if (kanjiCount === 1) return [fullRuby];

  let graphemes;
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      graphemes = [...seg.segment(fullRuby)].map(s => s.segment);
    } else {
      graphemes = Array.from(fullRuby);
    }
  } catch (_) {
    graphemes = Array.from(fullRuby);
  }
  const gLen = graphemes.length;
  if (gLen === 0) return empty;

  const result = [];
  let consumed = 0;
  for (let i = 0; i < kanjiCount; i++) {
    const bucketEnd = Math.floor(gLen * (i + 1) / kanjiCount);
    const take = Math.max(0, Math.min(gLen - consumed, bucketEnd - consumed));
    result.push(graphemes.slice(consumed, consumed + take).join(''));
    consumed += take;
  }
  if (consumed < gLen) {
    result[result.length - 1] += graphemes.slice(consumed).join('');
  }
  return result;
}

/**
 * 抄 AMLL 的拆分算法：
 *   输入 word.text（可能是「態度した」这种混合）
 *   输出 [ {kanji, okurigana, endIdx, ruby}... ]
 *
 * 与原 splitKanjiUnits 的接口契约完全一致，line-renderer.js 无需改动：
 *   - units.length<=1 时，调用方会退回整段 ruby
 *   - units[i].endIdx 对应 coreText.substring 的字符索引（用于截取 leading 前导）
 *   - units[i].kanji + units[i].okurigana + leading 拼回原 coreText
 */
export function splitKanjiUnits(text, ruby) {
  const raw = text || '';
  if (!raw) return [];
  const chars = Array.from(raw);

  // Step 1: 提取每个 CJK 字在 chars 中的索引（跳过非汉字）
  const cjkRuns = []; // {charIdx, runIdx}
  for (let i = 0; i < chars.length; i++) {
    if (isCJKChar(chars[i])) {
      cjkRuns.push(i);
    }
  }
  if (cjkRuns.length <= 1) {
    // ⭐ 和原 splitKanjiUnits 行为一致：没汉字 / 只有 1 个汉字 → 回退 appendRubyWord 不拆
    // 为了保留首汉字场景（此时应退回单字 appendRubyWord），直接返回 [] 与原算法在无汉字时一致
    // 但单字时原 splitKanjiUnits 会 push 1 个 unit，line-renderer 里 units.length<=1 会走回退
    // 所以这里按原算法兼容：至少保留 1 个汉字时返回它
    if (cjkRuns.length === 0) return [];
    const onlyIdx = cjkRuns[0];
    const units = [{
      kanji: chars[onlyIdx],
      okurigana: chars.slice(onlyIdx + 1).join(''),
      endIdx: onlyIdx + 1,
      ruby: ruby || chars.slice(0, onlyIdx).join(''),
    }];
    if (ruby) units[0].ruby = ruby;
    return units;
  }

  // Step 2: 连续汉字段 → 分配 ruby（多段时整段 ruby 按汉字数权重累加分配）
  //   先把 cjkRuns 切成连续段（原 chars 中 index 连续）
  const runs = [];
  let cur = [cjkRuns[0]];
  for (let i = 1; i < cjkRuns.length; i++) {
    if (cjkRuns[i] === cur[cur.length - 1] + 1) {
      cur.push(cjkRuns[i]);
    } else {
      runs.push(cur);
      cur = [cjkRuns[i]];
    }
  }
  runs.push(cur);

  // Step 3: 把整段 ruby 按每段汉字数再按权重分配（汉字总数就是 cjkRuns.length）
  const totalKanji = cjkRuns.length;
  // 把 fullRuby 先按总汉字数分配，然后在各段里按顺序归到每个汉字
  const perKanjiRubies = distributeRubyToKanji(ruby || '', totalKanji);

  const units = [];
  let globalKanjiIdx = 0;
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r];
    for (let k = 0; k < run.length; k++) {
      const charIdx = run[k];
      const isLastKanjiOfLastRun = r === runs.length - 1 && k === run.length - 1;
      // okurigana 直到下一个汉字 char（或末尾），原 splitKanjiUnits 取 substring(units[i-1].endIdx, 此汉字的 charIdx)
      let okurigana = '';
      if (k === run.length - 1) {
        // 连续段最后一个汉字 → okurigana 直到下一段第一个汉字或末尾
        const nextCharIdx = (r === runs.length - 1)
          ? chars.length
          : runs[r + 1][0];
        okurigana = chars.slice(charIdx + 1, nextCharIdx).join('');
      }
      units.push({
        kanji: chars[charIdx],
        okurigana,
        endIdx: charIdx + 1,
        ruby: perKanjiRubies[globalKanjiIdx] || '',
      });
      globalKanjiIdx++;
    }
  }

  return units;
}


