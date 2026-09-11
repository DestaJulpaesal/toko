import { useEffect, useState } from 'react';

export function formatCurrencyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? `Rp ${Number(digits).toLocaleString('id-ID')}` : '';
}

export function parseCurrencyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : '';
}

export default function CurrencyInput({ value, onValueChange, ...props }) {
  const [displayValue, setDisplayValue] = useState(formatCurrencyInput(value));

  useEffect(() => {
    setDisplayValue(formatCurrencyInput(value));
  }, [value]);

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={(event) => {
        const nextValue = parseCurrencyInput(event.target.value);
        setDisplayValue(formatCurrencyInput(nextValue));
        onValueChange(nextValue);
      }}
    />
  );
}
