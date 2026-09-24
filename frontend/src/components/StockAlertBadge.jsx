/**
 * StockAlertBadge Component
 * Displays stock urgency status with color coding
 * 
 * Props:
 *   - currentStock: Current stock quantity
 *   - minimumStock: Minimum threshold
 *   - maximumStock: Maximum capacity (optional)
 */
export default function StockAlertBadge({ currentStock, minimumStock, maximumStock }) {
  let status = 'NORMAL';
  let bgColor = '#4CAF50'; // Green

  if (currentStock < minimumStock) {
    status = 'URGENT';
    bgColor = '#f44336'; // Red
  } else if (currentStock < minimumStock * 1.5) {
    status = 'LOW';
    bgColor = '#ff9800'; // Orange
  } else if (maximumStock && currentStock >= maximumStock) {
    status = 'OVERSTOCK';
    bgColor = '#2196F3'; // Blue
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '20px',
        backgroundColor: bgColor,
        color: 'white',
        fontSize: '11px',
        fontWeight: 'bold',
        marginLeft: '8px',
        whiteSpace: 'nowrap',
      }}
      title={`Stock: ${currentStock} / Min: ${minimumStock}${maximumStock ? ` / Max: ${maximumStock}` : ''}`}
    >
      {status}
    </span>
  );
}
