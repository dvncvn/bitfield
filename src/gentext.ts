/** Generative text — cryptic, atmospheric word combinations */

const NOUNS = [
  'void', 'pattern', 'cycle', 'dream', 'haze', 'pulse',
  'grid', 'signal', 'drift', 'phase', 'loop', 'static',
  'noise', 'grain', 'field', 'mesh', 'glow', 'shade',
  'bloom', 'trace', 'fog', 'frame', 'flux', 'edge',
  'depth', 'layer', 'zone', 'wave', 'break', 'scan',
  'form', 'space', 'lapse', 'tone', 'shift', 'blur',
  'sync', 'ghost', 'cell', 'arc', 'veil',
  'slab', 'ring', 'node', 'seam', 'span', 'axis',
  'core', 'dome', 'rift', 'dust', 'echo', 'wake', 'mono', 'poly',
  'lfo', 'noise', 'osc', 'sine', 'triangle', 'wave', 'square', 'saw', 'reverb', 'freeze',
  'place', 'focus', 'shine', 'plane', 'vary', 'veil', 'sheen', 'pull', 'polar',
];

const MODIFIERS = [
  'soft', 'deep', 'slow', 'low', 'raw', 'thin',
  'cold', 'flat', 'dark', 'dim', 'pale', 'null',
  'half', 'late', 'long', 'lost', 'warm', 'wide',
  'still', 'bare', 'faint', 'dense',
  'hollow', 'inner', 'outer', 'minor', 'quiet', 'lucid',
];

const FRAGMENTS = [
  'no exit', 'end loop', 'sub zero', 'half light', 'low end',
  'after dark', 'no signal', 'all clear', 'flat line', 'zero sum',
  'false dawn', 'last scan', 'soft reset', 'deep cut', 'slow burn',
  'night mode', 'grey area', 'raw data', 'soft focus',
  'open field', 'lost time', 'near void', 'far grid', 'dim pulse', 'warm static',
  'keep hope', 'stay close', 'be still', 'breathe slow', 'hold on',
  'let go', 'move soft', 'look up', 'feel more', 'stay warm',
  'go deep', 'find light', 'trust fall', 'run free', 'dream loud', 'feel something',
];

/** Simple seeded pick */
function pick<T>(arr: T[], hash: number): T {
  return arr[((hash >>> 0) % arr.length)];
}

/** Hash step — better avalanche for adjacent seeds */
function next(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Unicode glitch substitutions — visually similar or aesthetically broken */
const GLITCH_MAP: Record<string, string[]> = {
  a: ['α', 'ä', 'â', 'ā', 'à'],
  b: ['ß', 'þ', 'ƀ'],
  c: ['ç', 'ĉ', '¢'],
  d: ['đ', 'ð', 'ď'],
  e: ['ë', 'ê', 'ē', 'è', 'ε'],
  f: ['ƒ'],
  g: ['ğ', 'ĝ'],
  h: ['ħ', 'ĥ'],
  i: ['ï', 'î', 'ī', 'ì', 'ı'],
  l: ['ł', 'ĺ', '|'],
  m: ['ṁ'],
  n: ['ñ', 'ń', 'ŋ'],
  o: ['ö', 'ô', 'ø', 'ō', 'ò', '0'],
  p: ['þ', 'ρ'],
  r: ['ŗ', 'ř'],
  s: ['ś', 'š', 'ş', '$'],
  t: ['ţ', 'ŧ', '†'],
  u: ['ü', 'û', 'ū', 'ù', 'µ'],
  v: ['ν'],
  w: ['ŵ'],
  x: ['×', '✕'],
  y: ['ÿ', 'ý'],
  z: ['ž', 'ź', 'ż'],
  ' ': [' ', '·', ' ', '_'],
};

/** ASCII block/symbol characters for harder glitches */
const BLOCKS = [
  '#', '@', '%', '&', '*', '/', '\\', '|',
  '_', '-', '=', '+', '.', ':', ';', '!',
  '[', ']', '{', '}', '<', '>', '~', '^',
];

/** Glitch a string — randomly corrupt `intensity` fraction of characters */
export function glitchText(text: string, intensity: number = 0.15): string {
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    if (Math.random() > intensity) continue;
    // ~20% chance of a block character instead of a letter swap
    if (Math.random() < 0.2) {
      chars[i] = BLOCKS[Math.floor(Math.random() * BLOCKS.length)];
      continue;
    }
    const c = chars[i].toLowerCase();
    const subs = GLITCH_MAP[c];
    if (subs) {
      chars[i] = subs[Math.floor(Math.random() * subs.length)];
    }
  }
  return chars.join('');
}

/** Pure ASCII symbol sequences */
const GLYPHS = [
  '////', '\\\\\\\\', '||||', '----', '====',
  '####', '....', '::::',  '****', '++++',
  '/\\/\\', '><><', '[][]', '{}{}', '()()',
  '~-~-', '-ede-', '._._', '-ede-', '>><<',
  '#_#_', '|.|.', '/./.',  '=*=*', '-..-',
];

const SYMBOL_FRAGMENTS = [
  '/// void', '>> pulse', '<< drift', ':: sync',
  '## grid', '-- null', '++ flux', '~~ haze',
  '00:00:00', 'ff:ff:ff', '0x000', '0xfff',
  '||| scan', '/// loop', '<<< rift', '>>> wake',
  '__ zone __', '.. trace ..', '// break //', ':: node ::',
];

export function generateText(seed: number): string {
  // Extra mixing to ensure adjacent seeds diverge
  let h = next(seed + 1);
  h = next(h);
  h = next(h);

  const roll = (h % 8);
  h = next(h);
  const h2 = next(h);
  const h3 = next(h2);

  switch (roll) {
    case 0:
      return pick(NOUNS, h);
    case 1:
      return pick(MODIFIERS, h) + ' ' + pick(NOUNS, h2);
    case 2:
      return pick(FRAGMENTS, h);
    case 3:
      return pick(NOUNS, h) + ' / ' + pick(NOUNS, h2);
    case 4:
      return pick(MODIFIERS, h) + ' ' + pick(NOUNS, h2) + ' ' + String((h3 % 99) + 1).padStart(2, '0');
    case 5:
      return pick(GLYPHS, h);
    case 6:
      return pick(SYMBOL_FRAGMENTS, h);
    case 7:
    default:
      // glyph + word combo
      return pick(GLYPHS, h) + ' ' + pick(NOUNS, h2);
  }
}
