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
          50: '#fff5f0',
          100: '#ffe8dc',
          200: '#ffd0b8',
          300: '#ffad86',
          400: '#ff7e47',
          500: '#ff5c28',
          600: '#e84c1a',
          700: '#c73b0f',
          800: '#9e2f0e',
          900: '#80270f',
        },
        ink: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          400: '#9ca3af',
          500: '#6b7280',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#090d16',
        },
        cream: '#f3f4f6',
      },
      boxShadow: {
        card: '0 1px 3px rgba(17,24,39,.05), 0 8px 24px -12px rgba(17,24,39,.08)',
        lift: '0 4px 12px rgba(17,24,39,.06), 0 20px 40px -16px rgba(17,24,39,.14)',
        glow: '0 10px 28px -8px rgba(255, 92, 40, .45)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #ff5722 0%, #ff7033 55%, #ff8a3d 100%)',
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
