// Direction A: the same tokens as today; the change is structure and flatter surfaces
tailwind.config = { theme: { extend: { colors: {
  brand: { 50: '#e6f2f1', 100: '#cfe7e6', 200: '#a6d3d2', 300: '#73b8b9', 400: '#3e989c', 500: '#1c8790', 600: '#12808a', 700: '#0b6e77', 800: '#095a62', 900: '#084a50', 950: '#06373b' },
  saffron: { 50: '#fdf4e1', 100: '#fbe6b8', 400: '#f0b53f', 500: '#e9a21a', 600: '#c7850b', 700: '#8a5a00', 800: '#6e4800' },
  neutral: { 50: '#f4f7f6', 100: '#ebf0ef', 200: '#dce4e2', 300: '#c7d2cf', 400: '#9aaba7', 500: '#616f6c', 600: '#5a6966', 700: '#44524f', 800: '#2c3836', 900: '#16211f', 950: '#0d1514' },
} } } };
const LOGO = (cls = 'size-9') => `<svg viewBox="0 0 100 100" class="${cls} shrink-0" aria-hidden="true"><rect width="100" height="100" rx="26" fill="#0b6e77"/><circle cx="45" cy="44" r="21" fill="none" stroke="#fff" stroke-width="10"/><path d="M60 59 75 74" stroke="#fff" stroke-width="11" stroke-linecap="round"/><circle cx="45" cy="44" r="7.5" fill="#e9a21a"/></svg>`;
