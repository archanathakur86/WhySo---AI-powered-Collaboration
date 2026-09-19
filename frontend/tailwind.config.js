/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f5ff",
          100: "#dbe6fe",
          500: "#4f6df5",
          600: "#3d54e0",
          700: "#3143b8",
          900: "#1f2a70",
        },
      },
    },
  },
  plugins: [],
};
