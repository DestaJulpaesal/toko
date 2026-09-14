export function printReceipt(elementId) {
  const receipt = document.getElementById(elementId);
  if (!receipt) {
    throw new Error('Struk tidak ditemukan untuk dicetak.');
  }

  const printWindow = window.open('', '_blank', 'width=420,height=760');
  if (!printWindow) {
    throw new Error('Jendela cetak diblokir browser. Izinkan pop-up untuk mencetak struk.');
  }

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((style) => style.outerHTML)
    .join('');

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Struk Glosir</title>
        ${styles}
        <style>
          @page { margin: 12mm; size: A4 portrait; }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            width: auto;
            min-height: 0;
            overflow: visible;
          }
          body * { visibility: visible !important; }
          body {
            display: block !important;
            color: #000 !important;
            font-family: Arial, sans-serif !important;
          }
          #printable-receipt {
            width: 180mm !important;
            max-width: 180mm !important;
            min-height: 0 !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 auto;
            padding: 8mm !important;
            border: 1px solid #000 !important;
            box-shadow: none !important;
            color: #000 !important;
            background: #fff !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            font-family: "Courier New", monospace !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
          }
          #printable-receipt,
          #printable-receipt * {
            box-sizing: border-box !important;
            max-height: none !important;
          }
          #printable-receipt .receipt-items-list,
          #printable-receipt .receipt-summary,
          #printable-receipt .receipt-footer {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
          }
          .receipt-shop-head h2 { font-size: 22px !important; }
          .receipt-shop-head p,
          .receipt-shop-head small,
          .receipt-meta,
          .receipt-items-list,
          .receipt-summary,
          .receipt-footer { overflow: visible !important; }
          .receipt-shop-head p,
          .receipt-shop-head small { font-size: 10px !important; }
          .receipt-meta { gap: 3px !important; font-size: 10px !important; }
          .receipt-meta div,
          .receipt-sum-row { display: grid !important; grid-template-columns: 1fr auto; gap: 4px; }
          .receipt-item-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 4px;
            break-inside: avoid-page;
            page-break-inside: avoid;
          }
          .receipt-item-title strong { font-size: 11px !important; }
          .receipt-item-title span,
          .receipt-summary { font-size: 10px !important; }
          .receipt-items-list { gap: 4px !important; }
          .receipt-summary { gap: 2px !important; }
          .receipt-sum-row.total-row { font-size: 13px !important; }
          .receipt-point-summary,
          .receipt-point-summary-box,
          .receipt-footer small { display: none !important; }
          .receipt-footer {
            display: block !important;
            margin-top: 10px !important;
            padding-bottom: 0 !important;
            break-after: avoid-page;
            page-break-after: avoid;
          }
          .receipt-footer p {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #000 !important;
            font-weight: 700 !important;
            text-align: center !important;
          }
          .receipt-divider-dash {
            border-top: 1px solid #000 !important;
            height: 0 !important;
            opacity: 1 !important;
          }
          .no-print { display: none !important; }
        </style>
      </head>
      <body>${receipt.outerHTML}</body>
    </html>`);
  printWindow.document.close();

  let hasStarted = false;
  const startPrint = () => {
    if (hasStarted) return;
    hasStarted = true;
    printWindow.focus();
    printWindow.print();
  };
  printWindow.addEventListener('afterprint', () => {
    setTimeout(() => printWindow.close(), 200);
  }, { once: true });
  printWindow.addEventListener('load', () => setTimeout(startPrint, 250), { once: true });
  setTimeout(startPrint, 800);
}
