/**
 * Tailwind DIPAKAI TERBATAS: hanya utilitas (tanpa preflight/reset) dan hanya untuk
 * komponen yang memang ditulis dengan class Tailwind. Halaman lain tetap memakai
 * tokens.css + ui.css. Kalau ada komponen baru yang memakai Tailwind, tambahkan di `content`.
 */
module.exports = {
  content: [
    './src/components/ExpiryAlertWidget.jsx',
    './src/components/LoyaltyPointsModal.jsx',
  ],
  darkMode: 'class',
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
