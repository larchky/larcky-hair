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
        primary: "#000000",
        accent: "#f7d879",
        studio: "#0b0a08",
        graphite: "#171512",
        champagne: "#f5ead2",
        signal: "#2dd4bf",
      },
    },
  },
  plugins: [],
};
