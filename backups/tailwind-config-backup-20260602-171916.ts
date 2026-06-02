import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    darkMode: "class",
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
        extend: {
                colors: {
                        // Compucity Brand Colors
                        compucity: {
                                green: '#3A8B68',
                                'green-light': '#75AD95',
                                'green-dark': '#2F6F55',
                                'green-50': '#EFF5F2',
                                'green-100': '#D7E7E0',
                                'green-200': '#B0D4C2',
                                'green-300': '#8CC0A8',
                                'green-400': '#5FA882',
                                'green-500': '#3A8B68',
                                'green-600': '#2F7A5A',
                                'green-700': '#256549',
                                'green-800': '#1B4D37',
                                'green-900': '#1A3E2E',
                                'green-950': '#0F2A1E',
                                dark: '#1a1a2e',
                                'dark-light': '#2d2d44',
                        },
                        // shadcn/ui CSS variable colors
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
                        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
                        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
                        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
                        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
                        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
                        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        chart: {
                                '1': 'hsl(var(--chart-1))',
                                '2': 'hsl(var(--chart-2))',
                                '3': 'hsl(var(--chart-3))',
                                '4': 'hsl(var(--chart-4))',
                                '5': 'hsl(var(--chart-5))'
                        }
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                },
                fontFamily: {
                        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
                        mono: ['var(--font-geist-mono)', 'monospace'],
                },
        }
  },
  plugins: [tailwindcssAnimate],
};
export default config;
