import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'civic-blue': {
          50: '#e6f0ff', 100: '#b3d9ff', 200: '#80c2ff', 300: '#4dabff',
          400: '#4d94ff', 500: '#1a66cc', 600: '#0052b3', 700: '#003d85',
          800: '#002952', 900: '#001a33',
        },
        'activist-orange': {
          50: '#fff4e6', 100: '#ffe0b3', 200: '#ffcc80', 300: '#ffb84d',
          400: '#ff9933', 500: '#ff6600', 600: '#e65c00', 700: '#cc5200',
          800: '#994000', 900: '#662b00',
        },
        'urban-gray': {
          50: '#f8f9fa', 100: '#e9ecef', 200: '#dee2e6', 300: '#ced4da',
          400: '#adb5bd', 500: '#6c757d', 600: '#495057', 700: '#343a40',
          800: '#212529', 900: '#0d1117',
        },
        'protest-red': {
          100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
          500: '#dc2626', 600: '#b91c1c', 700: '#991b1b', 800: '#7f1d1d', 900: '#450a0a',
        },
        'grassroots-green': {
          100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
          500: '#16a34a', 600: '#15803d', 700: '#166534', 800: '#14532d', 900: '#052e16',
        },
        'warning-yellow': {
          100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12',
        },
        primary: { DEFAULT: "hsl(209, 100%, 45%)", foreground: "hsl(0, 0%, 100%)" },
        secondary: { DEFAULT: "hsl(25, 100%, 50%)", foreground: "hsl(0, 0%, 100%)" },
        background: "hsl(0, 0%, 100%)",
        foreground: "hsl(222, 47%, 11%)",
        muted: { DEFAULT: "hsl(210, 17%, 95%)", foreground: "hsl(215, 13%, 34%)" },
        border: "hsl(214, 20%, 85%)",
        input: "hsl(214, 20%, 85%)",
        ring: "hsl(25, 100%, 50%)",
        card: { DEFAULT: "hsl(0, 0%, 100%)", foreground: "hsl(222, 47%, 11%)" },
        destructive: { DEFAULT: "hsl(0, 72%, 51%)", foreground: "hsl(0, 0%, 100%)" },
        accent: { DEFAULT: "hsl(210, 17%, 95%)", foreground: "hsl(222, 47%, 11%)" },
      },
      borderRadius: { lg: "0.5rem", md: "0.375rem", sm: "0.25rem" },
      fontFamily: {
        activist: ['Oswald', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'activist': '3px 3px 0px 0px rgba(0, 0, 0, 0.9)',
        'activist-lg': '6px 6px 0px 0px rgba(0, 0, 0, 0.9)',
        'activist-hover': '2px 2px 0px 0px rgba(0, 0, 0, 0.9)',
        'glow-orange': '0 0 20px rgba(255, 102, 0, 0.3)',
        'glow-blue': '0 0 20px rgba(26, 102, 204, 0.3)',
      },
      animation: {
        'pulse-activist': 'pulse-activist 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-activist': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 102, 0, 0.7)', transform: 'scale(1)' },
          '50%': { boxShadow: '0 0 0 12px rgba(255, 102, 0, 0)', transform: 'scale(1.02)' },
        },
        'slide-in': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
