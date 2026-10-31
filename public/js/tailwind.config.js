/**
 * Configuración de Tailwind (Play CDN).
 * Convivencia con Bootstrap 5:
 *  - important: true  -> las utilidades Tailwind ganan a las de Bootstrap con el mismo nombre (p-4, gap-3, shadow...).
 *  - preflight: false -> Bootstrap Reboot es el reset base (preflight rompería .btn, .form-control, etc.).
 *  - container/visibility desactivados -> evitan choque con .container y .collapse de Bootstrap.
 */
tailwind.config = {
  important: true,
  corePlugins: {
    preflight: false,
    container: false,
    visibility: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fff6f1',
          100: '#ffeadf',
          200: '#ffd0b8',
          300: '#ffad86',
          400: '#ff8152',
          500: '#ff5a1f',
          600: '#f03f0a',
          700: '#c72e08',
          800: '#9e270e',
          900: '#80240f',
        },
        ink: {
          50: '#f6f5f4',
          100: '#e7e5e2',
          200: '#d1ccc7',
          400: '#8f877f',
          500: '#6b635b',
          700: '#3a342f',
          800: '#26211d',
          900: '#171310',
          950: '#0d0a08',
        },
        cream: '#fbf8f5',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,19,16,.04), 0 8px 24px -12px rgba(23,19,16,.12)',
        lift: '0 2px 4px rgba(23,19,16,.04), 0 24px 48px -16px rgba(23,19,16,.22)',
        glow: '0 10px 30px -8px rgba(255, 90, 31, .55)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #ff8152 0%, #ff5a1f 45%, #f03f0a 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop': {
          '0%': { transform: 'scale(.6)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        bump: {
          '0%, 100%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.25)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.2,.7,.2,1) both',
        pop: 'pop .5s cubic-bezier(.2,.7,.2,1) both',
        bump: 'bump .35s ease-out',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
};
