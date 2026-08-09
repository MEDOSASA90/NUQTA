/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        /* shadcn tokens re-mapped to the warm paper & ink palette */
        primary: {
          DEFAULT: "#A87438",
          foreground: "#FFFDF8",
          50: "#FAF3E8",
          100: "#F2E4CC",
          300: "#D2AB70",
          400: "#C8985E",
          500: "#A87438",
          600: "#8F5E2B",
          700: "#754A21",
          900: "#452C15",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "#A03E31",
          foreground: "#FFFDF8",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        /* ---- لوحة «ورق وحبر» — design.md §٢ ---- */
        paper: {
          base: "#F6F1E7",
          surface: "#FDFBF5",
          sunken: "#EFE8D8",
        },
        line: {
          DEFAULT: "#E5DAC6",
          strong: "#D5C7AB",
        },
        ink: {
          900: "#2C2418",
          700: "#4E4333",
          500: "#7C7060",
          400: "#A29685",
        },
        gold: {
          100: "#F5EBCE",
          500: "#C29B3C",
          600: "#A8842C",
        },
        /* الألوان الدلالية — حالات السداد */
        laha: {
          text: "#4F6B3E",
          bg: "#E7EEDC",
          solid: "#5F7A4C",
        },
        aleh: {
          text: "#9A5238",
          bg: "#F5E4DC",
          solid: "#B26A4A",
        },
        partial: {
          text: "#8A6114",
          bg: "#F6ECD3",
          solid: "#B07E22",
        },
        over: {
          text: "#7C6210",
          bg: "#F7EFD8",
          solid: "#A8842C",
        },
        open: {
          text: "#7C7060",
          bg: "#EFE8D8",
          solid: "#8A7C6A",
        },
        redink: {
          DEFAULT: "#A03E31",
          bg: "#F8E9E2",
        },
        whatsapp: {
          DEFAULT: "#2F7A4B",
          bg: "#E4F0E6",
          solid: "#3F8E5A",
        },
      },
      fontFamily: {
        kufi: ['"Noto Kufi Arabic"', '"IBM Plex Sans Arabic"', 'sans-serif'],
        plex: ['"IBM Plex Sans Arabic"', '"Noto Kufi Arabic"', 'sans-serif'],
        ruqaa: ['"Aref Ruqaa"', '"Noto Kufi Arabic"', 'serif'],
      },
      borderRadius: {
        xl: "14px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        card: "0 1px 2px rgba(74,58,35,.05), 0 10px 28px -12px rgba(74,58,35,.12)",
        "card-hover": "0 2px 3px rgba(74,58,35,.06), 0 14px 36px -12px rgba(74,58,35,.18)",
        pop: "0 2px 6px rgba(74,58,35,.08), 0 24px 64px -16px rgba(74,58,35,.22)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
