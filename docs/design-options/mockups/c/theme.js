// Direction C «محله»: the same turquoise and saffron used more boldly (saffron as a fill with dark
// text, a deep turquoise band with a tile pattern), Estedad instead of Vazirmatn, larger photos.
document.write(`<style>
@font-face{font-family:Estedad;src:url(../Estedad.woff2) format('woff2');font-weight:100 900;unicode-range:U+0600-06FF,U+0750-077F,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FEFF}
@font-face{font-family:Estedad;src:url(../Estedad-latin.woff2) format('woff2');font-weight:100 900;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{--ff:Estedad}
.girih{background-color:#084a50;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'%3E%3Cg fill='none' stroke='%2373b8b9' stroke-opacity='.22' stroke-width='1.2'%3E%3Cpath d='M28 4 34 22 52 28 34 34 28 52 22 34 4 28 22 22Z'/%3E%3Cpath d='M0 0 10 10M56 0 46 10M0 56 10 46M56 56 46 46'/%3E%3Ccircle cx='28' cy='28' r='5'/%3E%3C/g%3E%3C/svg%3E")}
</style>`);
tailwind.config = { theme: { extend: { colors: {
  brand: { 50: '#e6f2f1', 100: '#cfe7e6', 200: '#a6d3d2', 300: '#73b8b9', 400: '#3e989c', 500: '#1c8790', 600: '#12808a', 700: '#0b6e77', 800: '#095a62', 900: '#084a50', 950: '#06373b' },
  saffron: { 50: '#fdf4e1', 100: '#fbe6b8', 300: '#f5c862', 400: '#f0b53f', 500: '#e9a21a', 700: '#8a5a00', 800: '#6e4800' },
  neutral: { 50: '#f4f7f6', 100: '#ebf0ef', 200: '#dce4e2', 300: '#c7d2cf', 400: '#9aaba7', 500: '#616f6c', 600: '#5a6966', 700: '#44524f', 800: '#2c3836', 900: '#16211f', 950: '#0d1514' },
  page: '#eef4f3',
} } } };
const LOGO = (cls = 'size-9', onDark = false) => `<svg viewBox="0 0 100 100" class="${cls} shrink-0" aria-hidden="true"><rect width="100" height="100" rx="26" fill="${onDark ? '#fff' : '#0b6e77'}"/><circle cx="45" cy="44" r="21" fill="none" stroke="${onDark ? '#0b6e77' : '#fff'}" stroke-width="10"/><path d="M60 59 75 74" stroke="${onDark ? '#0b6e77' : '#fff'}" stroke-width="11" stroke-linecap="round"/><circle cx="45" cy="44" r="7.5" fill="#e9a21a"/></svg>`;
