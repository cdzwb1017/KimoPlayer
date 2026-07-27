import { parseLRC } from './lyrics.js';

const testLRC = `[00:22.564]淡[00:23.184]き[00:24.613]光[00:24.853]立[00:25.096]つ[00:25.348]俄[00:25.994]雨[00:26.719]
[00:22.564]淡薄的阳光中突然一阵骤雨
[00:27.750]い[00:28.702]と[00:29.336]し[00:29.768]面[00:30.092]影[00:30.370]の[00:30.707]沈[00:31.330]丁[00:31.658]花[00:32.328]
[00:27.750]动人的瑞香花的容颜中
[00:33.247]溢[00:34.549]る[00:34.833]る[00:35.146]涙[00:35.631]の[00:36.040]蕾[00:36.885]か[00:37.177]ら[00:37.711]
[00:33.247]宛若泪水盈盈般的花蕾处`;

const result = parseLRC(testLRC);
console.log('=== Parse Result ===');
result.forEach((entry, i) => {
  console.log(`[${i}] time=${entry.time.toFixed(3)}`);
  console.log(`    text: "${entry.text}"`);
  console.log(`    translation: "${entry.translation || '(none)'}"`);
  console.log(`    words: ${entry.words ? entry.words.length + ' words' : 'none'}`);
});
