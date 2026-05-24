/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2f2110",
        accent: "#bf8f2f",
        studio: "#fffaf0",
        graphite: "#f4e8cf",
        champagne: "#4a371d",
        signal: "#5f8f7a",
      },
    },
  },
  plugins: [],
};
