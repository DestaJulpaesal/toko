// Barcode utilities for Glosir POS & Inventory

// Audio beep using native Web Audio API (Supermarket Scanner sound)
export function playBeep(freq = 1400, duration = 0.1) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // audio context might be blocked until user gesture
  }
}

// Generate unique 12-digit EAN-style barcode (Indonesian standard prefix 899)
export function generateAutoBarcode(prefix = '899', existingList = []) {
  const existingSkus = new Set(existingList.map((p) => String(p.sku || '').trim()));
  let candidate = '';
  let attempts = 0;

  do {
    // 899 followed by 9 random digits
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
    candidate = `${prefix}${randomDigits}`;
    attempts += 1;
  } while (existingSkus.has(candidate) && attempts < 100);

  return candidate;
}

// Code 128 pattern table (107 patterns of bars and spaces)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '233111',
];

// Convert any string to Code 128-B bar pattern
export function encodeCode128(text = '') {
  const clean = String(text || 'GLS001').replace(/[^\x20-\x7E]/g, '');
  if (!clean) return '';

  const START_B = 104;
  const STOP = 106;

  let checksum = START_B;
  const indices = [START_B];

  for (let i = 0; i < clean.length; i += 1) {
    const code = clean.charCodeAt(i) - 32;
    indices.push(code);
    checksum += code * (i + 1);
  }

  const checkChar = checksum % 103;
  indices.push(checkChar);
  indices.push(STOP);

  let patternStr = '';
  for (const idx of indices) {
    if (idx >= 0 && idx < CODE128_PATTERNS.length) {
      patternStr += CODE128_PATTERNS[idx];
    }
  }

  return patternStr;
}

// SVG Barcode Renderer Component
export function BarcodeSvg({ value, height = 45, width = 180, showText = true }) {
  const pattern = encodeCode128(value);
  if (!pattern) return null;

  let currentX = 0;
  const rects = [];
  const unitWidth = 1.4;

  for (let i = 0; i < pattern.length; i += 1) {
    const widthUnits = parseInt(pattern[i], 10);
    const w = widthUnits * unitWidth;
    const isBar = i % 2 === 0;

    if (isBar) {
      rects.push(
        <rect
          key={i}
          x={currentX}
          y={0}
          width={w}
          height={height}
          fill="#111827"
        />
      );
    }
    currentX += w;
  }

  const totalWidth = currentX;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: '#fff', padding: '4px 6px', borderRadius: '4px' }}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        style={{ width: `${width}px`, height: `${height}px`, display: 'block' }}
      >
        {rects}
      </svg>
      {showText && (
        <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '2px', color: '#333', marginTop: '2px' }}>
          {value}
        </span>
      )}
    </div>
  );
}

// Preset popular Indonesian grocery items with realistic barcodes
export const PRESET_INDONESIA_GROCERY = [
  {
    name: 'Indomie Goreng Spesial 85g',
    sku: '8998866200213',
    category: 'Bahan Pokok',
    price: 3500,
    originalPrice: 3800,
    stock: 120,
    status: 'Aktif',
  },
  {
    name: 'Beras Setra Ramos 5 Kg',
    sku: '8993189211054',
    category: 'Bahan Pokok',
    price: 72000,
    originalPrice: 75000,
    stock: 25,
    status: 'Aktif',
  },
  {
    name: 'Minyak Goreng Sania Pouch 2L',
    sku: '8992775210028',
    category: 'Kebutuhan Dapur',
    price: 35500,
    originalPrice: 39000,
    stock: 40,
    status: 'Aktif',
  },
  {
    name: 'Gula Pasir Gulaku Kuning 1 Kg',
    sku: '8992759110016',
    category: 'Bahan Pokok',
    price: 18000,
    originalPrice: 19500,
    stock: 50,
    status: 'Aktif',
  },
  {
    name: 'Tepung Terigu Segitiga Biru 1 Kg',
    sku: '8992745120015',
    category: 'Bahan Pokok',
    price: 13500,
    originalPrice: 15000,
    stock: 35,
    status: 'Aktif',
  },
  {
    name: 'Kopi Kapal Api Spesial Mix 10x24g',
    sku: '8991001111245',
    category: 'Glosir',
    price: 16500,
    originalPrice: 18000,
    stock: 60,
    status: 'Aktif',
  },
  {
    name: 'Teh Celup Sariwangi 25 Kantong',
    sku: '8999999052028',
    category: 'Minuman',
    price: 8500,
    originalPrice: 9500,
    stock: 45,
    status: 'Aktif',
  },
  {
    name: 'Susu Kental Manis Frisian Flag 370g',
    sku: '8992753010015',
    category: 'Kebutuhan Dapur',
    price: 13000,
    originalPrice: 14500,
    stock: 30,
    status: 'Aktif',
  },
  {
    name: 'Kecap Manis Bango Refill 550ml',
    sku: '8999999021208',
    category: 'Kebutuhan Dapur',
    price: 24500,
    originalPrice: 27000,
    stock: 25,
    status: 'Aktif',
  },
  {
    name: 'Sirup Marjan Boudoin Melon 460ml',
    sku: '8992735110014',
    category: 'Minuman',
    price: 22000,
    originalPrice: 25000,
    stock: 30,
    status: 'Aktif',
  },
  {
    name: 'Sabun Mandi Lifebuoy Total 10 110g',
    sku: '8999999001125',
    category: 'Glosir',
    price: 4500,
    originalPrice: 5000,
    stock: 80,
    status: 'Aktif',
  },
  {
    name: 'Deterjen Daia Putih 850g',
    sku: '8998866100124',
    category: 'Glosir',
    price: 19500,
    originalPrice: 22000,
    stock: 25,
    status: 'Aktif',
  },
  {
    name: 'Sarden ABC Saus Tomat 155g',
    sku: '8991002101012',
    category: 'Bahan Pokok',
    price: 10500,
    originalPrice: 12000,
    stock: 35,
    status: 'Aktif',
  },
  {
    name: 'Royco Kaldu Ayam  sachet 9g',
    sku: '8999999011026',
    category: 'Kebutuhan Dapur',
    price: 1000,
    originalPrice: 1200,
    stock: 100,
    status: 'Aktif',
  },
  {
    name: 'Saus Sambal ABC 335ml',
    sku: '8991002102057',
    category: 'Kebutuhan Dapur',
    price: 12500,
    originalPrice: 14500,
    stock: 30,
    status: 'Aktif',
  },
  {
    name: 'Biskuit Roma Kelapa 300g',
    sku: '8991002103023',
    category: 'Glosir',
    price: 11500,
    originalPrice: 13000,
    stock: 45,
    status: 'Aktif',
  },
  {
    name: 'Energen Sereal Cokelat 10 Sachet',
    sku: '8991002104075',
    category: 'Minuman',
    price: 18500,
    originalPrice: 21000,
    stock: 28,
    status: 'Aktif',
  },
  {
    name: 'Teh Pucuk Harum 350ml',
    sku: '8999999053032',
    category: 'Minuman',
    price: 3500,
    originalPrice: 4000,
    stock: 60,
    status: 'Aktif',
  },
  {
    name: 'Aqua Air Mineral 600ml',
    sku: '8999999046010',
    category: 'Minuman',
    price: 3000,
    originalPrice: 3500,
    stock: 72,
    status: 'Aktif',
  },
  {
    name: 'Pepsodent Pasta Gigi 190g',
    sku: '8991002105096',
    category: 'Glosir',
    price: 11500,
    originalPrice: 13500,
    stock: 32,
    status: 'Aktif',
  },
  {
    name: 'Shampoo Pantene 170ml',
    sku: '8991002106048',
    category: 'Glosir',
    price: 22000,
    originalPrice: 25000,
    stock: 24,
    status: 'Aktif',
  },
  {
    name: 'Tissue Paseo Facial 250 Sheet',
    sku: '8991002107052',
    category: 'Glosir',
    price: 12500,
    originalPrice: 15000,
    stock: 20,
    status: 'Aktif',
  },
  {
    name: 'Kecap Sedap Refill 600ml',
    sku: '8991002108065',
    category: 'Kebutuhan Dapur',
    price: 13500,
    originalPrice: 15500,
    stock: 30,
    status: 'Aktif',
  },
  {
    name: 'Bumbu Racik Ayam Goreng 20g',
    sku: '8991002109079',
    category: 'Kebutuhan Dapur',
    price: 2500,
    originalPrice: 3000,
    stock: 70,
    status: 'Aktif',
  },
];

// Parse multi-line bulk text:
// Format: Nama Barang, Harga Eceran, Stok, [Harga Warung], [Harga Coret], [Barcode]
export function parseBulkProductText(text, existingProducts = []) {
  if (!text || !text.trim()) return [];

  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim());
  const results = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed
      .split(/[,;\t]+/)
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter((value, index, array) => !(index === array.length - 1 && value === ''));

    if (parts.length >= 1 && parts[0]) {
      const name = parts[0];
      const price = Number(parts[1]) || 10000;
      const stock = parts[2] !== undefined ? Number(parts[2]) : 20;
      const wholesalePrice = parts[3] ? Number(parts[3]) : null;
      const originalPrice = parts[4] ? Number(parts[4]) : null;
      const barcode = parts[5] ? String(parts[5]) : '';

      const sku = `GLS-${Date.now()}-${results.length + 1}`;

      const discountPercent = originalPrice && originalPrice > price
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0;

      results.push({
        id: Date.now() + Math.floor(Math.random() * 10000),
        name,
        sku,
        barcode,
        category: 'Glosir',
        price,
        wholesalePrice: wholesalePrice || null,
        originalPrice,
        discountPercent,
        stock,
        status: 'Aktif',
      });
    }
  }

  return results;
}

export function parseCsvProductText(text, existingProducts = []) {
  if (!text || !text.trim()) return [];

  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];

  const normalizeRow = (line) => line
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((value) => value.trim().replace(/^"|"$/g, ''));

  const header = normalizeRow(lines[0]).map((value) => value.toLowerCase());
  const hasHeader = header.some((value) => ['nama', 'name', 'produk', 'item'].includes(value));
  const startIndex = hasHeader ? 1 : 0;

  const results = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    const parts = normalizeRow(lines[index]);
    const nameIndex = header.indexOf('nama');
    const priceIndex = header.indexOf('harga jual');
    const wholesalePriceIndex = header.indexOf('harga warung');
    const stockIndex = header.indexOf('stok');
    const originalPriceIndex = header.indexOf('harga normal');
    const barcodeIndex = header.indexOf('barcode');

    const name = parts[hasHeader ? nameIndex : 0] || parts[0];
    const price = Number(hasHeader ? (parts[priceIndex] || parts[1]) : parts[1]) || 10000;
    const wholesalePrice = hasHeader ? (parts[wholesalePriceIndex] ? Number(parts[wholesalePriceIndex]) : null) : null;
    const stock = Number(hasHeader ? (parts[stockIndex] || parts[2]) : parts[2]) || 20;
    const originalPrice = Number(hasHeader ? (parts[originalPriceIndex] || parts[3]) : parts[3]) || null;
    const barcode = hasHeader ? (parts[barcodeIndex] || '') : (parts[5] || '');

    if (!name) continue;

    const sku = `GLS-${Date.now()}-${results.length + 1}`;
    const discountPercent = originalPrice && Number(originalPrice) > price
      ? Math.round(((Number(originalPrice) - price) / Number(originalPrice)) * 100)
      : 0;

    results.push({
      id: Date.now() + Math.floor(Math.random() * 10000),
      name,
      sku,
      barcode,
      category: 'Glosir',
      price,
      wholesalePrice,
      originalPrice: originalPrice || null,
      discountPercent,
      stock,
      status: 'Aktif',
    });
  }

  return results;
}

