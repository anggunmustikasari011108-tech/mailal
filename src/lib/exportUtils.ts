import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, OrderItem } from '../types';
import { formatIDR, formatJakartaDate, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from './formatters';

export function exportInvoicePDF(
  order: Order,
  items: OrderItem[],
  brandName: string,
  projectName: string,
  address: string
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFontSize(18);
  doc.setTextColor(57, 69, 54);
  doc.text(brandName.toUpperCase(), 40, 48);
  doc.setFontSize(10);
  doc.setTextColor(129, 123, 114);
  doc.text(projectName, 40, 64);
  doc.text(address, 40, 78);

  doc.setFontSize(14);
  doc.setTextColor(57, 69, 54);
  doc.text('INVOICE RESMI', 420, 48);
  doc.setFontSize(10);
  doc.text(`No: ${order.invoiceNumber}`, 420, 64);
  doc.text(`Tanggal: ${formatJakartaDate(order.createdAt)}`, 420, 78);

  doc.setDrawColor(197, 164, 109);
  doc.line(40, 96, 555, 96);

  doc.setFontSize(10);
  doc.setTextColor(57, 69, 54);
  doc.text(`Kepada: ${order.customerName}`, 40, 118);
  doc.text(`WhatsApp: ${order.customerPhone} | Email: ${order.customerEmail}`, 40, 134);
  doc.text(
    `Alamat: ${order.shippingAddress.fullAddress}, ${order.shippingAddress.district}, ${order.shippingAddress.city}, ${order.shippingAddress.province} ${order.shippingAddress.postalCode}`,
    40,
    150,
    { maxWidth: 510 }
  );
  doc.text(
    `Metode: ${PAYMENT_METHOD_LABELS[order.paymentMethod]} | Status Bayar: ${PAYMENT_STATUS_LABELS[order.paymentStatus]} | Status Pesanan: ${ORDER_STATUS_LABELS[order.orderStatus]}`,
    40,
    178
  );

  autoTable(doc, {
    startY: 196,
    head: [['SKU', 'Produk', 'Varian', 'Qty', 'Harga Satuan', 'Subtotal']],
    body: items.map((item) => [
      item.sku,
      item.productName,
      `${item.colorName} · ${item.size}`,
      String(item.quantity),
      formatIDR(item.unitPrice),
      formatIDR(item.subtotal),
    ]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [135, 151, 123], textColor: [255, 255, 255] },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 360;
  doc.setFontSize(10);
  doc.text(`Subtotal Produk: ${formatIDR(order.subtotal)}`, 360, finalY + 24);
  doc.text(`Diskon Voucher: -${formatIDR(order.discountAmount)}`, 360, finalY + 40);
  doc.text(`Ongkos Kirim: ${formatIDR(order.shippingCost)}`, 360, finalY + 56);
  doc.setFontSize(12);
  doc.text(`Total Pembayaran: ${formatIDR(order.totalAmount)}`, 360, finalY + 76);

  doc.save(`${order.invoiceNumber}.pdf`);
}

export interface ReportExportRow {
  [key: string]: string | number;
}

export function exportReportPDF(
  title: string,
  brandName: string,
  periodLabel: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  summaryLines: string[]
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  doc.setFontSize(16);
  doc.setTextColor(57, 69, 54);
  doc.text(`${brandName} — ${title}`, 40, 44);
  doc.setFontSize(10);
  doc.setTextColor(129, 123, 114);
  doc.text(`Periode: ${periodLabel} · Dicetak pada ${formatJakartaDate(new Date())}`, 40, 60);

  autoTable(doc, {
    startY: 78,
    head: [headers],
    body: rows,
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [135, 151, 123], textColor: [255, 255, 255] },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 320;
  doc.setFontSize(10);
  doc.setTextColor(57, 69, 54);
  summaryLines.forEach((line, idx) => {
    doc.text(line, 40, finalY + 24 + idx * 16);
  });

  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

function escapeXmlCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return safe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportReportExcel(fileName: string, sheetName: string, rows: ReportExportRow[]): void {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const headerXml = headers
    .map((h) => `<Cell><Data ss:Type="String">${escapeXmlCell(h)}</Data></Cell>`)
    .join('');

  const bodyXml = rows
    .map((row) => {
      const cells = headers
        .map((h) => {
          const val = row[h];
          if (typeof val === 'number' && Number.isFinite(val)) {
            return `<Cell><Data ss:Type="Number">${val}</Data></Cell>`;
          }
          return `<Cell><Data ss:Type="String">${escapeXmlCell(String(val ?? ''))}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXmlCell(sheetName.slice(0, 31))}">
  <Table>
   <Row>${headerXml}</Row>
   ${bodyXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
