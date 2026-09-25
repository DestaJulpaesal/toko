/**
 * Stock Calculation Utilities
 * Handle konversi stok dari berbagai satuan ke satuan dasar
 */

/**
 * Hitung stok berkurang untuk order item
 * @param {number} quantity - jumlah dalam satuan unit
 * @param {number} conversionToBase - berapa banyak satuan dasar dalam 1 unit
 * @returns {number} total stok berkurang dalam satuan dasar
 */
export function calculateStockDecrease(quantity, conversionToBase) {
  return Number(quantity) * Number(conversionToBase);
}

/**
 * Format stok untuk display user-friendly
 * Contoh: 12 batang + 5 gram -> "12 bungkus + 5 batang"
 * @param {number} baseStockQty - total stok dalam satuan dasar
 * @param {Array} units - array ProductUnit sorted by conversionToBase descending
 * @returns {string} formatted stok
 */
export function formatStockDisplay(baseStockQty, units) {
  if (!units || units.length === 0) return `${baseStockQty}`;

  const stock = Number(baseStockQty);
  const parts = [];
  let remaining = stock;

  // Sort units by conversion descending (biggest first)
  const sortedUnits = [...units].sort((a, b) => Number(b.conversionToBase) - Number(a.conversionToBase));

  for (const unit of sortedUnits) {
    const conversion = Number(unit.conversionToBase);
    if (conversion === 1) break; // Skip base unit in middle

    const count = Math.floor(remaining / conversion);
    if (count > 0) {
      parts.push(`${count} ${unit.name}`);
      remaining -= count * conversion;
    }
  }

  // Add remaining in base unit
  if (remaining > 0) {
    const baseUnit = units.find((u) => Number(u.conversionToBase) === 1);
    const unitName = baseUnit?.name || 'satuan';
    parts.push(`${remaining} ${unitName}`);
  }

  return parts.length > 0 ? parts.join(' + ') : '0';
}

/**
 * Validasi stok cukup untuk order
 * @param {number} baseStockQty - stok dalam satuan dasar
 * @param {number} requestedQty - jumlah yang diminta dalam satuan unit
 * @param {number} conversionToBase - konversi factor
 * @returns {Object} { isValid, message, shortageQty }
 */
export function validateStock(baseStockQty, requestedQty, conversionToBase) {
  const required = calculateStockDecrease(requestedQty, conversionToBase);
  const available = Number(baseStockQty);

  if (available >= required) {
    return { isValid: true, message: '', shortageQty: 0 };
  }

  const shortageQty = required - available;
  const shortageInUnit = shortageQty / Number(conversionToBase);

  return {
    isValid: false,
    message: `Stok tidak cukup. Kurang ${shortageInUnit.toFixed(2)} unit.`,
    shortageQty,
  };
}

/**
 * Validasi stok tersedia (simplified)
 * @param {number} baseStockQty - stok dalam satuan dasar
 * @param {number} requestedQty - jumlah yang diminta
 * @returns {boolean} true jika stok cukup
 */
export function validateStockAvailability(baseStockQty, requestedQty) {
  return Number(baseStockQty) >= Number(requestedQty);
}

/**
 * Hitung stok pengaman untuk restock
 * @param {number} avgDailyUsage - rata-rata pemakaian per hari dalam satuan dasar
 * @param {number} leadDays - berapa hari untuk barang datang
 * @param {number} safetyStock - multiplier untuk stok pengaman (default 2)
 * @returns {number} recommended stok dalam satuan dasar
 */
export function calculateSafetyStock(avgDailyUsage, leadDays, safetyStock = 2) {
  return Number(avgDailyUsage) * (Number(leadDays) + safetyStock);
}

/**
 * Parse quantity input (bisa dalam berbagai format)
 * @param {string} input - input user (e.g. "2.5", "1,5", "2 1/2")
 * @returns {number} parsed quantity atau null jika invalid
 */
export function parseQuantityInput(input) {
  if (!input) return null;

  const trimmed = String(input).trim();

  // Try parse decimal
  const decimal = parseFloat(trimmed.replace(',', '.'));
  if (!isNaN(decimal) && decimal > 0) return decimal;

  // Try parse fraction (e.g. "1/4")
  const fractionMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10);
    const denominator = parseInt(fractionMatch[2], 10);
    if (denominator !== 0) return numerator / denominator;
  }

  // Try parse mixed (e.g. "2 1/2")
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const numerator = parseInt(mixedMatch[2], 10);
    const denominator = parseInt(mixedMatch[3], 10);
    if (denominator !== 0) return whole + numerator / denominator;
  }

  return null;
}

/**
 * Hitung harga total dengan konversi unit
 * @param {number} quantity - jumlah dalam satuan unit
 * @param {number} sellPrice - harga per satuan unit
 * @returns {number} total harga
 */
export function calculateItemTotal(quantity, sellPrice) {
  return Number(quantity) * Number(sellPrice);
}

export default {
  calculateStockDecrease,
  formatStockDisplay,
  validateStock,
  calculateSafetyStock,
  parseQuantityInput,
  calculateItemTotal,
};
