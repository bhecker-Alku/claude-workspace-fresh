// Themed jelly avatar packs, ported from christmas-jelly-faces-six-updated.html and
// halloween-jelly-faces-cute-pumpkin.html. Each character has a costume (drawn behind and in front of
// the body), its own colors, and default eyes and mouth. A pack lists the eye and mouth styles a person
// can swap between; a character with mouth: null has no mouth (Rudy's nose and scarf take its place).
// Like jelly.css, these are the only colors outside tokens.css, and only for avatars.

const CHRISTMAS_BUBBLE = 'M75 23 C106 23 126 43 126 74 C126 99 108 115 92 120 Q83 125 79 137 Q74 128 69 124 C39 124 23 104 23 76 C23 43 45 23 75 23Z';
const HALLOWEEN_BUBBLE = 'M75 24 C108 24 128 43 128 74 C128 100 110 115 92 121 Q83 129 78 137 Q74 128 69 125 C39 124 22 105 22 75 C22 44 44 24 75 24Z';
const PUMPKIN_BODY = 'M75 27 C56 16 41 23 34 40 C21 50 19 66 23 78 C18 98 31 118 51 124 Q75 137 99 124 C122 119 135 100 128 78 C133 58 120 43 114 38 C103 23 89 20 75 27Z';

export const PACKS = {
  christmas: {
    label: 'Christmas',
    gradient: { x2: 0.85, mid: 0.58, x1: 0.08 },
    glare: '<path d="M40 52 Q53 34 77 33" stroke="white" stroke-width="7" stroke-linecap="round" opacity=".7" fill="none"/><ellipse cx="111" cy="94" rx="4" ry="10" fill="#fff" opacity=".2"/>',
    at: { lx: 55, ly: 70, rx: 95, ry: 70, mx: 75, my: 91, follow: [0.85, 0.85] },
    eyes: {
      oval: ['Oval', '<ellipse rx="7" ry="10" fill="currentColor"/>'],
      arc: ['Happy', '<path d="M-8 2 Q0 -8 8 2" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>'],
      dot: ['Button', '<circle r="6" fill="currentColor"/>'],
    },
    mouths: {
      smile: ['Smile', '<path d="M-11 0 Q0 15 11 0" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>'],
    },
    characters: [
      { id: 'santa', name: 'Santa', color: '#e84750', light: '#ff939b', ink: '#422c35', eyes: 'oval', mouth: null, // his beard costume draws the nose and mouth
        behind: '<path d="M29 97 Q20 104 37 120 Q47 137 59 130 Q75 151 91 131 Q109 138 118 116 Q132 103 119 95" fill="#fffefa" stroke="#e2edf0" stroke-width="3"/><path d="M37 95 Q34 105 48 108 Q49 119 61 117 Q75 130 90 117 Q105 119 106 108 Q118 106 113 95" fill="#fff"/>',
        front: '<path d="M28 46 Q39 13 88 11 Q105 2 117 13 Q102 22 109 39" fill="#d62e43" stroke="#9b2735" stroke-width="3"/><path d="M28 44 Q69 34 117 43" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round"/><circle cx="118" cy="14" r="12" fill="#fff"/><ellipse cx="75" cy="96" rx="9" ry="6" fill="#ffc0a7"/><path d="M60 102 Q75 115 90 102" fill="none" stroke="#ac5c57" stroke-width="4" stroke-linecap="round"/>' },
      { id: 'rudy', name: 'Rudy', color: '#b67a55', light: '#f5bc86', ink: '#452f31', eyes: 'oval', mouth: null,
        behind: '<path d="M45 44 L31 7 M32 24 L17 13 M35 32 L16 39 M105 44 L119 7 M118 24 L133 13 M115 32 L134 39" fill="none" stroke="#805037" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 57 Q13 24 12 59 Q17 77 35 68 M116 57 Q137 24 138 59 Q133 77 115 68" fill="#c98b63" stroke="#805037" stroke-width="3"/>',
        front: '<path d="M38 115 Q75 133 113 115" stroke="#3a9b65" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M65 119 L70 139 L84 122" fill="#e94653"/>', nose: '<ellipse cx="75" cy="95" rx="14" ry="12" fill="#ff4651" stroke="#bf263b" stroke-width="2"/><ellipse cx="70" cy="90" rx="5" ry="3" fill="#fff" opacity=".8"/>' },
      { id: 'elfie', name: 'Elfie', color: '#48b983', light: '#a4edb4', ink: '#2b5542', eyes: 'arc', mouth: 'smile',
        behind: '<path d="M29 71 L6 56 Q15 91 32 86 M121 71 L144 56 Q135 91 118 86" fill="#f4bba1" stroke="#d88e78" stroke-width="3"/>',
        front: '<path d="M31 44 L81 0 Q90 22 111 34 L117 44Z" fill="#209e5a" stroke="#147c48" stroke-width="3"/><path d="M35 43 Q72 51 117 43" stroke="#fff9eb" stroke-width="12" fill="none" stroke-linecap="round"/><circle cx="82" cy="5" r="9" fill="#f5c64d"/><path d="M50 117 Q75 128 100 117" fill="none" stroke="#d72e43" stroke-width="12" stroke-linecap="round"/><path d="M71 117 L64 137 L84 126" fill="#fff2b5"/>' },
      { id: 'candy', name: 'Candy Cane', color: '#f4f6f7', light: '#ffffff', ink: '#c83d55', eyes: 'oval', mouth: 'smile', stroke: '#d7c8c8', stripes: '#d8324c',
        behind: '',
        front: '<path d="M38 114 Q75 132 113 114" stroke="#d83e58" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M78 118 L91 137 L98 121" fill="#f4faf7" stroke="#dd5265" stroke-width="2"/>' },
      { id: 'frosty', name: 'Frosty', color: '#b8e7fa', light: '#ffffff', ink: '#3a647b', eyes: 'oval', mouth: 'smile',
        behind: '<path d="M36 45 L38 19 L108 19 L112 45" fill="#344d63"/><rect x="47" y="3" width="51" height="23" rx="3" fill="#344d63"/><path d="M48 18 H97" stroke="#dc4d5b" stroke-width="7"/>',
        front: '<path d="M36 110 Q75 132 113 110" fill="none" stroke="#d7515c" stroke-width="13" stroke-linecap="round"/><path d="M61 114 L58 139 L79 121" fill="#c8424f"/><circle cx="37" cy="104" r="4" fill="#e9faff"/><circle cx="114" cy="109" r="4" fill="#e9faff"/>', nose: '<g transform="translate(12 12.6) scale(.85)"><path d="M74 79 Q69 84 74 89 L97 85.6 Q98.6 84 97 82.4Z" fill="#f4932f" stroke="#d26f1d" stroke-width="1.6" stroke-linejoin="round"/><path d="M76 81.6 L92 83" stroke="#ffc685" stroke-width="1.6" stroke-linecap="round" opacity=".85"/><path d="M82 80.6 Q83.5 83 82 85.6 M89 81.6 Q90.2 83.6 89 85.4" fill="none" stroke="#d26f1d" stroke-width="1.2" stroke-linecap="round"/></g>' },
      { id: 'ginger', name: 'Ginger', color: '#c9854d', light: '#f4be7b', ink: '#694035', eyes: 'dot', mouth: 'smile',
        behind: '',
        front: '<path d="M34 64 Q38 34 75 31 Q112 34 116 64" fill="none" stroke="#fff6e8" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="0.1 10"/><path d="M45 110 L51 116 L57 110 L63 116 L69 110 L75 116 L81 110 L87 116 L93 110 L99 116 L105 110" fill="none" stroke="#fff6e8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="40" cy="88" rx="8" ry="5" fill="#ff8f86" opacity=".45"/><ellipse cx="110" cy="88" rx="8" ry="5" fill="#ff8f86" opacity=".45"/>' },
    ],
  },
  halloween: {
    label: 'Halloween',
    gradient: { x2: 0.95, mid: 0.42, x1: 0 },
    glare: '<path d="M38 53 Q46 32 76 33" stroke="white" opacity=".56" stroke-width="6" stroke-linecap="round" fill="none"/>',
    at: { lx: 54, ly: 69, rx: 96, ry: 69, mx: 75, my: 94, follow: [0.85, 0.85] },
    eyes: {
      oval: ['Oval', '<ellipse rx="7" ry="10" fill="currentColor"/>'],
      round: ['Round', '<circle r="7.5" fill="currentColor"/>'],
      smile: ['Happy', '<path d="M-9 1 Q0 10 9 1" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>'],
      cat: ['Cat', '<ellipse rx="8" ry="11" fill="#f1d77d"/><ellipse rx="2" ry="9" fill="#31253c"/>'],
      sparkle: ['Sparkly', '<ellipse rx="8" ry="10" fill="#513025"/><ellipse cx="-2.5" cy="-4" rx="2.6" ry="3.1" fill="white" opacity=".9"/>'],
    },
    mouths: {
      happy: ['Smile', '<path d="M-12 0 Q0 15 12 0" stroke="currentColor" stroke-width="4.5" fill="none" stroke-linecap="round"/>'],
      boo: ['Boo', '<ellipse cy="3" rx="7" ry="10" fill="currentColor"/>'],
      fangs: ['Fangs', '<path d="M-12 0 Q0 13 12 0" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M-8 3 L-4 11 L0 5 M4 5 L8 11 L11 2" fill="#fff6fd"/>'],
      cat: ['Cat', '<path d="M-10 1 Q-5 10 0 3 Q5 10 10 1" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round"/>'],
      pumpkin: ['Pumpkin', '<path d="M-14 -1 Q0 15 14 -1 Q0 7 -14 -1Z" fill="#63302a"/><path d="M-4 8 Q0 11 4 8" fill="none" stroke="#fa9e9c" stroke-width="2.2" stroke-linecap="round"/>'],
      carved: ['Carved', '<path d="M-19 -1 L-11 5 L-4 -1 L3 5 L11 -1 L19 3 Q2 19 -19 3Z" fill="#71322b" stroke="#61271e" stroke-width="1.5"/>'],
    },
    characters: [
      { id: 'pumpkin', name: 'Pumpkin', color: '#f38a32', light: '#ffd46e', ink: '#51252e', eyes: 'sparkle', mouth: 'pumpkin', body: PUMPKIN_BODY, stroke: '#d36d26', strokeWidth: 2.8,
        behind: '<path d="M67 32 C65 22 68 12 76 6 C80 3 86 2 89 5 C84 8 80 14 79 21 C78 26 79 30 81 33Z" fill="#7a5130" stroke="#5a3a20" stroke-width="2" stroke-linejoin="round"/><path d="M72 28 C71 19 74 12 81 7" fill="none" stroke="#a87a4c" stroke-width="2.2" stroke-linecap="round"/><path d="M74 22 Q77 20 79 22 M73 15 Q76 13 79 15" fill="none" stroke="#5a3a20" stroke-width="1.6" stroke-linecap="round"/><path d="M88 6 C97 1 104 8 99 14 C95 19 89 15 93 11" fill="none" stroke="#6b4628" stroke-width="2.6" stroke-linecap="round"/>',
        front: '<path d="M47 40 Q32 80 49 114 M61 31 Q49 82 63 122 M89 31 Q102 82 89 122 M103 40 Q119 80 102 114" fill="none" stroke="#bd5d2c" stroke-opacity=".26" stroke-width="4" stroke-linecap="round"/><path d="M39 58 Q36 81 43 97 M110 58 Q115 81 108 97" fill="none" stroke="#ffe8a2" stroke-opacity=".34" stroke-width="3" stroke-linecap="round"/><ellipse cx="38" cy="91" rx="10" ry="6" fill="#ff9a96" opacity=".56"/><ellipse cx="112" cy="91" rx="10" ry="6" fill="#ff9a96" opacity=".56"/><circle cx="113" cy="43" r="3.4" fill="#ffe9ac" opacity=".9"/>' },
      { id: 'ghost', name: 'Little Ghost', color: '#c4b1ed', light: '#ffffff', ink: '#543f70', eyes: 'oval', mouth: 'boo', stroke: '#faf7ff',
        behind: '<path d="M30 92 Q20 105 30 116 Q39 125 49 115 Q57 130 69 120 Q80 132 92 120 Q108 129 118 112 L119 87" fill="#f9f6ff" stroke="#c7bbef" stroke-width="2.5"/>',
        front: '<path d="M35 112 Q45 125 53 115 Q63 129 70 120 Q83 132 93 119 Q107 126 115 111" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><ellipse cx="48" cy="91" rx="9" ry="5" fill="#ffb9d8" opacity=".55"/><ellipse cx="102" cy="91" rx="9" ry="5" fill="#ffb9d8" opacity=".55"/>' },
      { id: 'bat', name: 'Baby Bat', color: '#8860be', light: '#c9a1f4', ink: '#fdf0ff', eyes: 'round', mouth: 'fangs',
        behind: '<path d="M32 67 Q19 37 3 51 Q10 63 4 77 Q17 69 24 85 L34 78 M116 67 Q132 37 147 51 Q140 63 146 77 Q132 69 126 85 L116 78" fill="#71428e" stroke="#c494e8" stroke-width="3" stroke-linejoin="round"/><path d="M45 40 L39 12 Q57 16 66 35 M84 35 Q94 16 111 12 L105 40" fill="#71428e" stroke="#c494e8" stroke-width="3" stroke-linejoin="round"/><path d="M48 31 L46 19 L59 35 M91 35 L104 19 L102 31" fill="#d3a0eb"/>',
        front: '<path d="M60 114 Q75 123 90 114" fill="none" stroke="#f4c5f1" stroke-width="3"/>' },
      { id: 'witchy', name: 'Witchy', color: '#a36bc5', light: '#e5aef5', ink: '#2e193d', eyes: 'smile', mouth: 'happy',
        behind: '',
        front: '<path d="M24 49 Q20 66 30 74 M126 49 Q131 66 120 74" fill="none" stroke="#3a2650" stroke-width="7" stroke-linecap="round"/><path d="M43 43 Q55 31 62 15 Q68 1 80 -3 Q93 -7 101 4 Q89 1 85 12 Q90 27 106 43Z" fill="#2a1c3a" stroke="#bc81d4" stroke-width="2.5" stroke-linejoin="round"/><path d="M64 16 Q70 5 79 1" fill="none" stroke="#5b3f78" stroke-width="3" stroke-linecap="round"/><path d="M47 37 Q75 30 102 37 L104 44 Q75 37 45 44Z" fill="#8a5bb3"/><path d="M8 44 Q75 27 142 44 Q124 57 75 52 Q26 57 8 44Z" fill="#2a1c3a" stroke="#bc81d4" stroke-width="2.5" stroke-linejoin="round"/><rect x="68" y="33" width="14" height="11" rx="2" fill="none" stroke="#ffe19a" stroke-width="3"/><path d="M102 106 Q116 109 118 99" stroke="#fff1a9" stroke-width="3" fill="none"/><path d="M116 91 L118 98 L126 100 L118 102 L116 110 L113 102 L107 100 L113 98Z" fill="#ffe4a0"/>' },
      { id: 'vampire', name: 'Vampire', color: '#6c3c70', light: '#ad6ca7', ink: '#fff0fb', eyes: 'oval', mouth: 'fangs',
        behind: '<path d="M32 47 L18 14 L53 37 M98 37 L132 14 L118 47" fill="#2b1a36" stroke="#a96d9b" stroke-width="3"/><path d="M27 96 Q12 115 32 132 L57 118 M123 96 Q138 115 118 132 L93 118" fill="#4c234c" stroke="#a66b9e" stroke-width="3"/>',
        front: '<path d="M28 42 Q40 21 60 30 L72 41 L84 26 Q102 20 121 43 L105 41 L91 52 L75 41 L60 52 L45 42Z" fill="#261629"/><path d="M39 111 Q75 128 111 111" fill="none" stroke="#a25368" stroke-width="9" stroke-linecap="round"/>' },
      { id: 'cat', name: 'Black Cat', color: '#45405c', light: '#8b799e', ink: '#f7e5ff', eyes: 'cat', mouth: 'cat',
        behind: '<path d="M30 57 L24 7 Q48 13 62 35 M88 35 Q103 13 126 7 L121 57" fill="#4a405e" stroke="#b29bbd" stroke-width="4" stroke-linejoin="round"/><path d="M31 44 L30 20 L49 35 M101 35 L120 20 L119 44" fill="#b57eae"/>',
        front: '<path d="M30 87 L7 80 M30 94 L8 96 M120 87 L143 80 M120 94 L142 96" fill="none" stroke="#dbc3e1" stroke-width="2.5" stroke-linecap="round"/>', nose: '<path d="M69 91 L81 91 L75 98Z" fill="#f8a7c5"/>' },
      { id: 'spider', name: 'Spiderling', color: '#af79c8', light: '#dfb0ef', ink: '#382240', eyes: 'round', mouth: 'happy',
        behind: '<path d="M40 57 Q23 35 7 47 M36 70 Q14 57 5 73 M38 86 Q14 90 9 108 M42 102 Q29 121 22 127 M110 57 Q127 35 143 47 M114 70 Q136 57 145 73 M112 86 Q136 90 141 108 M108 102 Q121 121 128 127" stroke="#bc88d7" stroke-width="6" fill="none" stroke-linecap="round"/>',
        front: '<circle cx="49" cy="96" r="5" fill="#efb1ce" opacity=".7"/><circle cx="101" cy="96" r="5" fill="#efb1ce" opacity=".7"/>' },
      { id: 'clown', name: 'Clown', color: '#eeeef2', light: '#ffffff', ink: '#1d1b22', eyes: 'oval', mouth: 'happy', stroke: '#c9c8d2',
        behind: '<g fill="#1d1b22"><circle cx="27" cy="58" r="11"/><circle cx="21" cy="72" r="10"/><circle cx="29" cy="85" r="9"/><circle cx="123" cy="58" r="11"/><circle cx="129" cy="72" r="10"/><circle cx="121" cy="85" r="9"/></g>',
        front: '<path d="M54 42 L57.5 49 L54 56 L50.5 49Z M96 42 L99.5 49 L96 56 L92.5 49Z" fill="#1d1b22"/><path d="M96 82 Q100 89 96 93 Q92 89 96 82Z" fill="#1d1b22"/><path d="M60 31 L81 5 L93 33Z" fill="#1d1b22" stroke="#4a4752" stroke-width="2" stroke-linejoin="round"/><circle cx="81" cy="6" r="6" fill="#fff" stroke="#1d1b22" stroke-width="2"/><circle cx="79" cy="21" r="3" fill="#fff"/><path d="M38 113 Q46 127 54 117 Q62 131 70 119 Q78 132 86 119 Q94 130 101 117 Q108 126 113 112" fill="#fff" stroke="#1d1b22" stroke-width="3" stroke-linejoin="round"/><circle cx="62" cy="122" r="2.6" fill="#1d1b22"/><circle cx="88" cy="122" r="2.6" fill="#1d1b22"/>', nose: '<circle cx="75" cy="84" r="5.5" fill="#1d1b22"/><circle cx="73.4" cy="82.4" r="1.6" fill="#fff" opacity=".85"/>' },
      { id: 'moon', name: 'Moon Spirit', color: '#6350a3', light: '#ada1e1', ink: '#f7eafe', eyes: 'smile', mouth: 'happy',
        behind: '<path d="M105 8 A22 22 0 1 0 128 37 A18 18 0 0 1 105 8" fill="#ffdf9c"/><path d="M23 32 L27 43 L38 47 L27 51 L23 62 L19 51 L8 47 L19 43Z" fill="#fff0b4"/>',
        front: '<path d="M100 101 l3 -7 3 7 7 3 -7 3 -3 7 -3 -7 -7 -3Z" fill="#e9d5ff" opacity=".8"/><circle cx="43" cy="108" r="3" fill="#fff4c7"/><circle cx="112" cy="67" r="2.5" fill="#fff4c7"/>' },
    ],
  },

  pokipals: {
    label: 'Pokipals',
    gradient: { x2: 0.95, mid: 0.45, x1: 0 },
    glare: '<path d="M38 53 Q46 33 76 33" stroke="white" opacity=".6" stroke-width="6" stroke-linecap="round" fill="none"/>',
    at: { lx: 55, ly: 71, rx: 95, ry: 71, mx: 75, my: 93, follow: [0.85, 0.85] },
    eyes: {
      sparkle: ['Sparkly', '<ellipse rx="8" ry="10" fill="currentColor"/><circle cx="-2.6" cy="-4" r="3.2" fill="#fff"/><circle cx="2.8" cy="3.4" r="1.5" fill="#fff" opacity=".8"/>'],
      round: ['Round', '<circle r="7.5" fill="currentColor"/><circle cx="-2.2" cy="-2.6" r="2.6" fill="#fff"/>'],
      happy: ['Happy', '<path d="M-8 3 Q0 -7 8 3" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>'],
      heart: ['Hearts', '<path d="M0 7 C-10 0 -9 -8 -4 -8 C-1.5 -8 0 -6 0 -4.5 C0 -6 1.5 -8 4 -8 C9 -8 10 0 0 7Z" fill="#ff5d7a"/><circle cx="-3.4" cy="-4.4" r="1.4" fill="#fff" opacity=".8"/>'],
      dot: ['Button', '<circle r="4.5" fill="currentColor"/>'],
    },
    mouths: {
      cat: ['Kitty', '<path d="M-9 0 Q-4.5 6 0 1 Q4.5 6 9 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'],
      smile: ['Smile', '<path d="M-11 0 Q0 13 11 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'],
      open: ['Excited', '<path d="M-9 -1 Q0 15 9 -1Z" fill="#7a2a2f"/><path d="M-4.5 6.5 Q0 10 4.5 6.5" fill="#ff8b94"/>'],
      tiny: ['Tiny', '<path d="M-5 1 Q0 6 5 1" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>'],
    },
    characters: [
      { id: 'sparky', name: 'Sparky', color: '#ffd23f', light: '#fff4a8', ink: '#2b2230', stroke: '#e3b100', eyes: 'round', mouth: 'cat',
        behind: '<path d="M40 50 Q22 22 24 0 Q46 16 60 40Z" fill="#ffd23f" stroke="#e3b100" stroke-width="2.5" stroke-linejoin="round"/><path d="M110 50 Q128 22 126 0 Q104 16 90 40Z" fill="#ffd23f" stroke="#e3b100" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 0 Q25 11 30 19 Q36 9 24 0Z M126 0 Q125 11 120 19 Q114 9 126 0Z" fill="#2b2230"/>',
        front: '<circle cx="36" cy="89" r="9.5" fill="#ef4b3a"/><circle cx="114" cy="89" r="9.5" fill="#ef4b3a"/>',
        nose: '<ellipse cx="75" cy="84" rx="2.3" ry="1.7" fill="#2b2230"/>' },
      { id: 'splash', name: 'Splash', color: '#8fd6ee', light: '#dcf6ff', ink: '#3a2430', stroke: '#5fb6d4', eyes: 'sparkle', mouth: 'smile',
        behind: '<path d="M18 92 Q14 124 75 132 Q136 124 132 92 Q128 116 75 120 Q22 116 18 92Z" fill="#c9793a" stroke="#995626" stroke-width="2.5" stroke-linejoin="round"/>',
        front: '<path d="M46 110 Q75 126 104 110 Q102 124 75 128 Q48 124 46 110Z" fill="#fff0a6" stroke="#e2c86a" stroke-width="1.5"/><ellipse cx="40" cy="89" rx="7" ry="4.5" fill="#ff9fb0" opacity=".5"/><ellipse cx="110" cy="89" rx="7" ry="4.5" fill="#ff9fb0" opacity=".5"/>' },
      { id: 'fluff', name: 'Fluff', color: '#b9854b', light: '#e9c48f', ink: '#2e1f17', stroke: '#8c5f30', eyes: 'sparkle', mouth: 'tiny',
        behind: '<path d="M24 86 Q6 92 11 106 Q0 117 14 124 Q9 137 28 136 Q31 149 51 141 Q61 151 75 143 Q89 151 99 141 Q119 149 122 136 Q141 137 136 124 Q150 117 139 106 Q144 92 126 86Z" fill="#f8ecd0" stroke="#dcc49a" stroke-width="2" stroke-linejoin="round"/><path d="M20 112 Q26 116 30 112 M120 112 Q124 116 130 112 M58 140 Q63 144 68 140 M82 140 Q87 144 92 140" fill="none" stroke="#e6d2a8" stroke-width="1.6" stroke-linecap="round"/><path d="M42 48 L16 2 Q46 6 64 34Z" fill="#b9854b" stroke="#8c5f30" stroke-width="2.5" stroke-linejoin="round"/><path d="M108 48 L134 2 Q104 6 86 34Z" fill="#b9854b" stroke="#8c5f30" stroke-width="2.5" stroke-linejoin="round"/><path d="M42 42 L25 10 Q44 14 56 34Z M108 42 L125 10 Q106 14 94 34Z" fill="#5e3b20"/>',
        front: '<path d="M64 30 L70 20 L75 29 L81 19 L86 30" fill="#b9854b" stroke="#8c5f30" stroke-width="2" stroke-linejoin="round"/>',
        nose: '<ellipse cx="75" cy="84" rx="3" ry="2.2" fill="#2e1f17"/>' },
    ],
  },
};
PACKS.christmas.bubble = CHRISTMAS_BUBBLE;
PACKS.halloween.bubble = HALLOWEEN_BUBBLE;
PACKS.pokipals.bubble = HALLOWEEN_BUBBLE;

/** The pack, character, and the eyes and mouth actually shown for a look; null for the classic look. */
export function resolvePack(look = {}) {
  const pack = PACKS[look.theme];
  if (!pack) return null;
  const character = pack.characters.find((c) => c.id === look.character) || pack.characters[0];
  const eyes = pack.eyes[look.packEyes] ? look.packEyes : character.eyes;
  const mouth = character.mouth === null ? null : pack.mouths[look.packMouth] ? look.packMouth : character.mouth;
  return { pack, character, eyes, mouth };
}
