// Parameterized SVG mascot generator for とらんすナビ.
// One recurring chibi character, varied by hair, skin, expression and scene,
// so the cast feels like a small community rather than a single avatar.
// All colors come from the site's pastel palette.

const HAIR = {
  lavender: ['#d7c6f0', '#c3aee8', '#b3a3d2'],
  pink: ['#ffc8dd', '#ff9ec4', '#e58aad'],
  blue: ['#bfe0fb', '#9fcef7', '#7fa9d8'],
  brown: ['#e7c9a9', '#c79c74', '#a07a55'],
  mint: ['#c4ead6', '#9fdcbf', '#79bd9c'],
};
const SKIN = {
  pale: ['#fce9e0', '#eccfc4'],
  warm: ['#f2d2b1', '#dcb189'],
  deep: ['#c9966b', '#a9784f'],
};
const BODY = {
  blue: ['#bfe0fb', '#9fcef7'],
  pink: ['#f9cbdc', '#f3aac4'],
  mint: ['#c8ecd9', '#a6e0c3'],
  lilac: ['#ddd0f3', '#c8b6ec'],
};

// hair shapes (top of head). Each returns a <path d="..."> string for the given fill.
function hairPath(style, fill) {
  const spiky = 'M75 92 C73 56 96 44 120 44 C144 44 167 56 165 92 C160 78 150 72 150 72 C150 72 150 84 142 86 C138 74 132 70 132 70 C132 70 130 82 124 84 C120 70 112 68 112 68 C112 68 110 82 104 84 C100 72 92 72 92 76 C88 80 82 80 75 92 Z';
  const bob = 'M70 104 C66 58 92 42 120 42 C148 42 174 58 170 104 C168 86 162 78 162 78 C150 70 134 68 120 68 C106 68 90 70 78 78 C78 78 72 86 70 104 Z';
  const long = 'M68 150 C60 150 62 120 66 96 C62 58 92 42 120 42 C148 42 178 58 174 96 C178 120 180 150 172 150 C168 150 166 126 162 110 C156 92 150 84 150 84 C150 84 152 70 120 68 C88 70 90 84 90 84 C90 84 84 92 78 110 C74 126 72 150 68 150 Z';
  const d = style === 'bob' ? bob : style === 'long' ? long : spiky;
  return `<path d="${d}" fill="${fill}"/>`;
}

function expression(kind, ink) {
  // returns brows + eyes + mouth markup
  const brows = {
    unsure: `<path d="M99 79 q7.5 -4.5 15 -0.5" fill="none" stroke="HAIR2" stroke-width="2.6" stroke-linecap="round"/><path d="M126 78.5 q7.5 -4 15 0.5" fill="none" stroke="HAIR2" stroke-width="2.6" stroke-linecap="round"/>`,
    calm: `<path d="M99 80 q7.5 -3 15 0" fill="none" stroke="HAIR2" stroke-width="2.6" stroke-linecap="round"/><path d="M126 80 q7.5 -3 15 0" fill="none" stroke="HAIR2" stroke-width="2.6" stroke-linecap="round"/>`,
  }[kind === 'unsure' ? 'unsure' : 'calm'];
  const eyesOpen = `<ellipse cx="105" cy="96" rx="4.6" ry="6.2" fill="${ink}"/><ellipse cx="135" cy="96" rx="4.6" ry="6.2" fill="${ink}"/><circle cx="106.6" cy="93.6" r="1.5" fill="#fff"/><circle cx="136.6" cy="93.6" r="1.5" fill="#fff"/>`;
  const eyesHappy = `<path d="M100 98 q5 -5 10 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><path d="M130 98 q5 -5 10 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  const eyesDown = `<path d="M101 99 q4 3 8 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><path d="M131 99 q4 3 8 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  const mouths = {
    unsure: `<path d="M114 113 q6 4 12 0" fill="none" stroke="#c98aa0" stroke-width="2.6" stroke-linecap="round"/>`,
    soft: `<path d="M113 114 q7 5 14 0" fill="none" stroke="#c98aa0" stroke-width="2.6" stroke-linecap="round"/>`,
    big: `<path d="M111 113 q9 8 18 0" fill="none" stroke="#c98aa0" stroke-width="2.8" stroke-linecap="round"/>`,
  };
  const eyes = kind === 'happy' ? eyesHappy : kind === 'reading' ? eyesDown : eyesOpen;
  const mouth = kind === 'happy' ? mouths.big : kind === 'unsure' ? mouths.unsure : mouths.soft;
  return brows + eyes + mouth;
}

export function mascot(opts = {}) {
  const {
    hair = 'lavender', hairStyle = 'spiky', skin = 'pale', body = 'blue',
    expr = 'soft', scene = 'none', id = 'm',
  } = opts;
  const [h1, h2, h3] = HAIR[hair];
  const [sk] = SKIN[skin];
  const [b1, b2] = BODY[body];
  const ink = '#4a5d80';

  const grads = `<defs>
    <linearGradient id="${id}-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${h1}"/><stop offset="1" stop-color="${h2}"/></linearGradient>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient>
    <linearGradient id="${id}-coat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eaf4fe"/></linearGradient>
  </defs>`;

  const shadow = `<ellipse cx="120" cy="190" rx="64" ry="11" fill="#9fcef7" opacity="0.22"/>`;

  // scene-specific extras drawn behind/around
  let bgExtras = '', bodyFill = `url(#${id}-body)`, bodyExtras = '', frontExtras = '', glasses = '';
  const sparkle = (x, y, s, c) => `<path d="M${x} ${y} l${s} ${s*2.5} ${s*2.5} ${s} -${s*2.5} ${s} -${s} ${s*2.5} -${s} -${s*2.5} -${s*2.5} -${s} ${s*2.5} -${s} z" fill="${c}"/>`;

  if (scene === 'thought') {
    bgExtras = `<circle cx="183" cy="44" r="22" fill="#fff" stroke="#cfe6fb" stroke-width="2"/><circle cx="158" cy="70" r="6.5" fill="#fff" stroke="#cfe6fb" stroke-width="2"/><circle cx="148" cy="84" r="3.7" fill="#fff" stroke="#cfe6fb" stroke-width="2"/><path d="M176 36c0-6 14-6 14 2 0 6-7 5-7 11" fill="none" stroke="#ff9ec4" stroke-width="3.4" stroke-linecap="round"/><circle cx="183" cy="56" r="2.1" fill="#ff9ec4"/>` + sparkle(54, 60, 2.4, '#ffd1e0') + sparkle(206, 112, 1.8, '#bfe0fb');
  } else if (scene === 'reading') {
    bgExtras = sparkle(52, 64, 2.4, '#ffd1e0') + sparkle(190, 54, 2.6, '#bfe0fb');
    glasses = `<circle cx="105" cy="97" r="11" fill="#fff" opacity="0.5"/><circle cx="135" cy="97" r="11" fill="#fff" opacity="0.5"/><circle cx="105" cy="97" r="11" fill="none" stroke="#7d8bb0" stroke-width="2.4"/><circle cx="135" cy="97" r="11" fill="none" stroke="#7d8bb0" stroke-width="2.4"/><path d="M116 97 h8" stroke="#7d8bb0" stroke-width="2.4" stroke-linecap="round"/>`;
    frontExtras = `<path d="M120 150 C108 142 92 142 84 146 L84 182 C92 178 108 178 120 184 Z" fill="#fff" stroke="#cfe6fb" stroke-width="2"/><path d="M120 150 C132 142 148 142 156 146 L156 182 C148 178 132 178 120 184 Z" fill="#fff" stroke="#cfe6fb" stroke-width="2"/><path d="M120 150 L120 184" stroke="#cfe6fb" stroke-width="2"/><path d="M92 156 h20 M92 164 h20 M92 172 h18" stroke="#cdd8ec" stroke-width="2" stroke-linecap="round"/><path d="M128 156 h20 M128 164 h20 M128 172 h18" stroke="#cdd8ec" stroke-width="2" stroke-linecap="round"/><circle cx="83" cy="176" r="9" fill="${sk}"/><circle cx="157" cy="176" r="9" fill="${sk}"/>`;
  } else if (scene === 'doctor') {
    bgExtras = sparkle(54, 70, 2.2, '#ffd1e0') + `<path d="M196 58 c0 -5 8 -5 8 0 c0 5 -8 9 -8 9 c0 0 -8 -4 -8 -9 c0 -5 8 -5 8 0 z" fill="#ffb3cd"/>`;
    bodyFill = `url(#${id}-coat)`;
    bodyExtras = `<path d="M120 132 L104 160 108 188" fill="none" stroke="#cfe2f6" stroke-width="2.4" stroke-linecap="round"/><path d="M120 132 L136 160 132 188" fill="none" stroke="#cfe2f6" stroke-width="2.4" stroke-linecap="round"/><path d="M108 134 C104 158 96 168 96 176" fill="none" stroke="#8fb7e6" stroke-width="3.2" stroke-linecap="round"/><path d="M132 134 C136 158 144 166 144 174" fill="none" stroke="#8fb7e6" stroke-width="3.2" stroke-linecap="round"/><circle cx="96" cy="180" r="6" fill="#a4c2f4" stroke="#7d9fe0" stroke-width="2"/>`;
  } else if (scene === 'wave') {
    bgExtras = sparkle(58, 66, 2.4, '#ffd1e0') + sparkle(196, 78, 2, '#bfe0fb') + sparkle(176, 46, 1.6, '#ffd1e0');
  } else if (scene === 'heart') {
    bgExtras = sparkle(56, 70, 2.2, '#ffd1e0') + sparkle(196, 84, 1.8, '#bfe0fb');
    // heart held in front of the body, cupped in both hands
    frontExtras = `<path d="M120 150 c-7 -10 -24 -5 -24 8 c0 11 24 24 24 24 c0 0 24 -13 24 -24 c0 -13 -17 -18 -24 -8 z" fill="#ff9ec4"/><circle cx="99" cy="172" r="9" fill="${sk}"/><circle cx="141" cy="172" r="9" fill="${sk}"/>`;
  }

  // hands: default at sides; wave raises the right hand
  const hands = scene === 'reading' || scene === 'heart'
    ? ''
    : scene === 'wave'
      ? `<circle cx="86" cy="158" r="10" fill="${sk}"/><circle cx="162" cy="92" r="11" fill="${sk}"/>`
      : `<circle cx="86" cy="158" r="10" fill="${sk}"/><circle cx="154" cy="158" r="10" fill="${sk}"/>`;

  const bodyShape = `<path d="M84 188 C80 150 86 128 120 128 C154 128 160 150 156 188 Z" fill="${bodyFill}"${scene === 'doctor' ? ' stroke="#dcebfb" stroke-width="1.5"' : ''}/>`;
  const head = `<circle cx="120" cy="92" r="46" fill="${sk}"/>`;
  const blush = `<ellipse cx="92" cy="107" rx="7" ry="4.2" fill="#fbb6ce" opacity="0.6"/><ellipse cx="148" cy="107" rx="7" ry="4.2" fill="#fbb6ce" opacity="0.6"/>`;
  const face = expression(expr, ink).replaceAll('HAIR2', h3);

  return `<svg viewBox="0 0 240 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="とらんすナビのキャラクター">
${grads}
${shadow}
${bgExtras}
${bodyShape}
${bodyExtras}
${hands}
${head}
${hairPath(hairStyle, `url(#${id}-hair)`)}
${face}
${glasses}
${blush}
${frontExtras}
</svg>`;
}

// CLI: write the named set to scripts/art/
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// Gender-neutral by design: only the unisex 'spiky' (tousled) and short 'bob'
// cuts, no lashes / lip color, neutral face + body. Variety comes from hair
// color and skin tone, never from anything that signals a gender.
const SET = {
  'home-welcome': { hair: 'lavender', hairStyle: 'spiky', skin: 'pale', body: 'lilac', expr: 'happy', scene: 'wave', id: 'w' },
  'unsure':       { hair: 'lavender', hairStyle: 'spiky', skin: 'pale', body: 'blue', expr: 'unsure', scene: 'thought', id: 'u' },
  'unsure-2':     { hair: 'mint', hairStyle: 'bob', skin: 'warm', body: 'mint', expr: 'unsure', scene: 'thought', id: 'u2' },
  'reading':      { hair: 'blue', hairStyle: 'bob', skin: 'warm', body: 'pink', expr: 'reading', scene: 'reading', id: 'r' },
  'doctor':       { hair: 'pink', hairStyle: 'spiky', skin: 'deep', body: 'blue', expr: 'happy', scene: 'doctor', id: 'd' },
  'support-heart':{ hair: 'brown', hairStyle: 'bob', skin: 'warm', body: 'pink', expr: 'soft', scene: 'heart', id: 'h' },
  'calm':         { hair: 'mint', hairStyle: 'spiky', skin: 'pale', body: 'lilac', expr: 'happy', scene: 'none', id: 'c' },
  // A diverse little crowd for the homepage hero (varied hair, skin, style).
  'person-1':     { hair: 'lavender', hairStyle: 'spiky', skin: 'pale', body: 'blue', expr: 'happy', scene: 'wave', id: 'pa' },
  'person-2':     { hair: 'pink', hairStyle: 'bob', skin: 'warm', body: 'pink', expr: 'soft', scene: 'none', id: 'pb' },
  'person-3':     { hair: 'blue', hairStyle: 'spiky', skin: 'deep', body: 'mint', expr: 'happy', scene: 'none', id: 'pc' },
  'person-4':     { hair: 'brown', hairStyle: 'bob', skin: 'warm', body: 'lilac', expr: 'soft', scene: 'none', id: 'pd' },
  'person-5':     { hair: 'mint', hairStyle: 'spiky', skin: 'pale', body: 'pink', expr: 'happy', scene: 'wave', id: 'pe' },
};
if (process.argv[1] && process.argv[1].endsWith('mascot.mjs') && process.argv.includes('--write')) {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = resolve(here, 'art');
  const map = {};
  for (const [name, opts] of Object.entries(SET)) {
    const svg = mascot(opts);
    writeFileSync(resolve(dir, `${name}.svg`), svg + '\n');
    map[name] = svg;
  }
  // Importable module for the <Mascot> Astro component (inline SVG, themeable).
  writeFileSync(resolve(here, '..', 'src', 'data', 'mascots.json'), JSON.stringify(map, null, 0) + '\n');
  console.log('wrote', Object.keys(SET).join(', '));
}
