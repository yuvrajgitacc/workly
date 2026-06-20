export default {
  content: ["./src/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          dark: "#1D4ED8",
        },
        cream: "#F5F0E8",
        charcoal: "#2A2A2A",
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        success: "var(--success)",
        warning: "var(--warning)",
        "google-blue": "var(--google-blue)",
        "google-red": "var(--google-red)",
        "google-yellow": "var(--google-yellow)",
        "google-green": "var(--google-green)",
      },
      fontFamily: { 
        sans: ["Google Sans Text", "Roboto", "Inter", "sans-serif"],
        display: ["Google Sans", "Roboto", "Inter", "sans-serif"],
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 12px)",
      },
      boxShadow: {
        'google-1': '0 1px 2px 0 rgba(60, 64, 67, 0.10), 0 1px 3px 1px rgba(60, 64, 67, 0.08)',
        'google-2': '0 1px 2px 0 rgba(60, 64, 67, 0.30), 0 2px 6px 2px rgba(60, 64, 67, 0.15)',
        'google-fab': '0 3px 5px -1px rgba(60, 64, 67, 0.30), 0 6px 10px 0 rgba(60, 64, 67, 0.15)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite'
      }
    }
  },
  plugins: []
}
