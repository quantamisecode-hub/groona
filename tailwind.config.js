/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class"],
	content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],

	theme: {
		/* ✅ Make Layout More Compact */
		container: {
			center: true,
			padding: "0.75rem",
			screens: {
				xl: "1000px",
				"2xl": "1100px",
			},
		},

		extend: {
			/* ✅ Smaller Global Typography */
			fontSize: {
				xs: "10px",
				sm: "11px",
				base: "12px", // Default was 16px → Now very small
				lg: "15px",
				xl: "25px",
				"2xl": "30px",
			},

			/* ✅ Global Scale Utilities */
			scale: {
				70: "0.7",
				75: "0.75",
				80: "0.8",
				85: "0.85",
				90: "0.9",
			},

			/* ✅ Smaller Border Radius */
			borderRadius: {
				lg: "10px",
				md: "8px",
				sm: "6px",
			},

			/* 🎨 Colors (Same as Your File) */
			colors: {
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",

				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},

				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},

				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},

				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},

				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},

				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},

				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},

				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",

				chart: {
					1: "hsl(var(--chart-1))",
					2: "hsl(var(--chart-2))",
					3: "hsl(var(--chart-3))",
					4: "hsl(var(--chart-4))",
					5: "hsl(var(--chart-5))",
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
			},

			/* ✅ Animations */
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},

				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
			},

			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
		},
	},

	plugins: [require("tailwindcss-animate")],
};
