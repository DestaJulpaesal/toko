export const DELIVERY_MINIMUM_SUBTOTAL = 100000;
export const FREE_DELIVERY_DISTANCE_KM = 1;
export const DELIVERY_RATE_PER_KM = 5000;
export const DELIVERY_STORAGE_KEY = 'glosir_delivery_v1';

export function calculateShippingCost(distanceKm, fulfillmentMethod = 'DELIVERY') {
  if (fulfillmentMethod !== 'DELIVERY') return 0;
  const distance = Math.max(0, Number(distanceKm) || 0);
  if (distance <= FREE_DELIVERY_DISTANCE_KM) return 0;
  return Math.ceil(distance - FREE_DELIVERY_DISTANCE_KM) * DELIVERY_RATE_PER_KM;
}

export function loadDeliveryPreference() {
  try {
    const saved = JSON.parse(localStorage.getItem(DELIVERY_STORAGE_KEY) || '{}');
    return {
      fulfillmentMethod: saved.fulfillmentMethod === 'PICKUP' ? 'PICKUP' : 'DELIVERY',
      distanceKm: Number(saved.distanceKm) > 0 ? Number(saved.distanceKm) : '',
    };
  } catch {
    return { fulfillmentMethod: 'DELIVERY', distanceKm: '' };
  }
}

export function saveDeliveryPreference(preference) {
  localStorage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify(preference));
}
