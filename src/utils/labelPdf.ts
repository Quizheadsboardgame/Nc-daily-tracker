import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { OnlineCard } from '../types';
import { formatCurrency } from '../db/cloudDatabase';

/**
 * Generates a crisp Code128 PNG Data URL for a given barcode string.
 */
export function generateBarcodeDataUrl(text: string): string {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
      format: 'CODE128',
      width: 2.2,
      height: 52,
      displayValue: true,
      fontSize: 14,
      font: 'monospace',
      fontOptions: 'bold',
      margin: 4,
      textMargin: 3,
      background: '#ffffff',
      lineColor: '#000000',
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('Failed to generate barcode image:', err);
    return '';
  }
}

/**
 * Generates and downloads or opens a single sticker/thermal label PDF (54mm x 28mm).
 * Standard thermal label size (2.125" x 1.1") widely used for card sleeves and top-loaders.
 */
export function downloadSingleLabelPdf(card: OnlineCard, vendorColor: string = '#2563eb'): void {
  // Label dimensions in mm: 54mm width x 28mm height
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [54, 28],
  });

  const barcodeDataUrl = generateBarcodeDataUrl(card.barcode);

  // Top header background strip
  doc.setFillColor(245, 245, 247);
  doc.rect(0, 0, 54, 5.5, 'F');

  // Vendor color indicator dot
  doc.setFillColor(vendorColor);
  doc.circle(2.5, 2.75, 1.2, 'F');

  // Vendor name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(40, 40, 40);
  const vendorDisplay = card.vendorName.length > 18 ? card.vendorName.slice(0, 16) + '..' : card.vendorName;
  doc.text(vendorDisplay.toUpperCase(), 4.5, 3.8);

  // "ONLINE" tag on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  doc.text('ONLINE SALE', 52, 3.8, { align: 'right' });

  // Card Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  const cardNameLines = doc.splitTextToSize(card.cardName, 35);
  const firstLine = cardNameLines[0] || card.cardName;
  const secondLine = cardNameLines.length > 1 ? cardNameLines[1] : '';
  doc.text(firstLine, 2, 8.5);
  if (secondLine) {
    doc.setFontSize(6.5);
    doc.text(secondLine.length > 25 ? secondLine.slice(0, 23) + '..' : secondLine, 2, 11.5);
  }

  // Price box (Large, bold, prominent)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(16, 120, 60); // Green price
  doc.text(formatCurrency(card.price), 52, 9.5, { align: 'right' });

  // Barcode Image
  if (barcodeDataUrl) {
    // x: 3, y: 12.5, width: 48, height: 14.5
    doc.addImage(barcodeDataUrl, 'PNG', 3, 12.2, 48, 14.8);
  }

  doc.save(`Barcode-Label-${card.barcode}.pdf`);
}

/**
 * Generates an A4 sheet PDF with multiple card barcode labels in a 3 x 8 grid (24 labels per page).
 */
export function downloadBatchLabelsPdf(
  cards: OnlineCard[],
  getVendorColor: (name: string) => string
): void {
  if (cards.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // 210mm x 297mm
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const cols = 3;
  const rows = 8;
  const labelWidth = 63.5;
  const labelHeight = 33.9;
  const marginLeft = (pageWidth - cols * labelWidth) / 2; // ~9.75mm
  const marginTop = (pageHeight - rows * labelHeight) / 2; // ~12.9mm

  cards.forEach((card, index) => {
    const pageIndex = Math.floor(index / (cols * rows));
    const labelOnPageIndex = index % (cols * rows);

    if (pageIndex > 0 && labelOnPageIndex === 0) {
      doc.addPage();
    }

    const col = labelOnPageIndex % cols;
    const row = Math.floor(labelOnPageIndex / cols);

    const x = marginLeft + col * labelWidth;
    const y = marginTop + row * labelHeight;

    // Draw border around label
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.2);
    doc.roundedRect(x + 1, y + 1, labelWidth - 2, labelHeight - 2, 1.5, 1.5, 'S');

    // Vendor strip
    const vendorColor = getVendorColor(card.vendorName);
    doc.setFillColor(vendorColor);
    doc.circle(x + 4, y + 4.5, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(50, 50, 50);
    const vendorStr = card.vendorName.length > 15 ? card.vendorName.slice(0, 13) + '..' : card.vendorName;
    doc.text(vendorStr.toUpperCase(), x + 6.5, 5.5 + y);

    // Online Tag
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(120, 120, 120);
    doc.text('ONLINE CARD', x + labelWidth - 3, 5.5 + y, { align: 'right' });

    // Card Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const nameLines = doc.splitTextToSize(card.cardName, labelWidth - 24);
    doc.text(nameLines[0] || card.cardName, x + 3, y + 10.5);

    // Price
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(16, 120, 60);
    doc.text(formatCurrency(card.price), x + labelWidth - 3, y + 10.5, { align: 'right' });

    // Barcode image
    const barcodeDataUrl = generateBarcodeDataUrl(card.barcode);
    if (barcodeDataUrl) {
      doc.addImage(barcodeDataUrl, 'PNG', x + 4, y + 13, labelWidth - 8, 17.5);
    }
  });

  doc.save(`Online-Card-Labels-${cards.length}-cards.pdf`);
}
