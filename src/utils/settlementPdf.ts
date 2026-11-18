import { jsPDF } from 'jspdf';
import { DayEventInfo } from '../types';
import { VendorWeekDetails, formatCurrency } from '../db/cloudDatabase';

export interface SettlementCalculation {
  grossSales: number;
  commissionPercent: number;
  commissionAmount: number;
  netSalesAfterCommission: number;
  cashTradesPaidOut: number;
  creditTradesIssued: number;
  netSettlementDue: number;
}

export function calculateVendorSettlement(
  details: VendorWeekDetails,
  commissionPercent: number
): SettlementCalculation {
  const safeRate = Math.max(0, Math.min(100, Number(commissionPercent) || 0));
  const grossSales = Math.round(details.totalRevenue * 100) / 100;
  const commissionAmount = Math.round(grossSales * (safeRate / 100) * 100) / 100;
  const netSalesAfterCommission = Math.round((grossSales - commissionAmount) * 100) / 100;
  const cashTradesPaidOut = Math.round(details.cashTradeValue * 100) / 100;
  const creditTradesIssued = Math.round(details.creditTradeValue * 100) / 100;
  const netSettlementDue = Math.round((netSalesAfterCommission - cashTradesPaidOut) * 100) / 100;

  return {
    grossSales,
    commissionPercent: safeRate,
    commissionAmount,
    netSalesAfterCommission,
    cashTradesPaidOut,
    creditTradesIssued,
    netSettlementDue,
  };
}

export function buildVendorSettlementText(
  details: VendorWeekDetails,
  commissionPercent: number,
  dayEventsByDate?: Map<string, DayEventInfo>
): string {
  const calc = calculateVendorSettlement(details, commissionPercent);
  const lines: string[] = [
    `VENDOR WEEKLY SETTLEMENT STATEMENT`,
    `Vendor: ${details.vendorName}`,
    `Period: ${details.weekInfo.label}`,
    `----------------------------------------`,
    `SALES SUMMARY (${details.salesCount} ${details.salesCount === 1 ? 'sale' : 'sales'}):`,
    `• Cash Sales: ${formatCurrency(details.cashRevenue)} (${details.cashCount})`,
    `• Card Sales: ${formatCurrency(details.cardRevenue)} (${details.cardCount})`,
    `• Online Sales: ${formatCurrency(details.onlineRevenue || 0)} (${details.onlineCount || 0})`,
    `• Traded Out: ${formatCurrency(details.tradedOutRevenue)} (${details.tradedOutCount})`,
    `• Gross Sales Total (Before Commission): ${formatCurrency(calc.grossSales)}`,
    ``,
    `TRADE-INS TAKEN IN (${details.tradeTakenInCount} ${details.tradeTakenInCount === 1 ? 'trade' : 'trades'}):`,
    `• Cash Payouts: -${formatCurrency(calc.cashTradesPaidOut)} (${details.cashTradeCount})`,
    `• Vendor Credit Issued: ${formatCurrency(calc.creditTradesIssued)} (${details.creditTradeCount})`,
    ``,
    `SETTLEMENT CALCULATION:`,
  ];

  if (calc.commissionPercent > 0) {
    lines.push(
      `• Gross Sales: ${formatCurrency(calc.grossSales)}`,
      `• Commission (${calc.commissionPercent}%): -${formatCurrency(calc.commissionAmount)}`,
      `• Sales After Commission: ${formatCurrency(calc.netSalesAfterCommission)}`,
      `• Less Cash Trade Payouts: -${formatCurrency(calc.cashTradesPaidOut)}`,
      `• Net Settlement Preview: ${formatCurrency(calc.netSettlementDue)}`
    );
  } else {
    lines.push(
      `• Gross Sales (0% preview — before commission reductions): ${formatCurrency(calc.grossSales)}`,
      `• Less Cash Trade Payouts: -${formatCurrency(calc.cashTradesPaidOut)}`,
      `• Gross Less Cash Payouts (Before Commission): ${formatCurrency(calc.netSettlementDue)}`
    );
  }

  const activeDays = details.dayBreakdown.filter((d) => d.salesCount > 0 || d.tradeTakenInCount > 0);
  if (activeDays.length > 0) {
    lines.push(``, `DAILY BREAKDOWN (Sun–Sat):`);
    for (const day of activeDays) {
      const ev = dayEventsByDate?.get(day.dateKey);
      const evTag = ev?.isEvent && ev.eventName ? ` [${ev.eventName}]` : '';
      lines.push(
        `• ${day.dayName} ${day.formattedDate}${evTag}: Sales ${formatCurrency(day.totalRevenue)} (${day.salesCount})` +
          (day.tradeTakenInCount > 0 ? ` | Trades ${formatCurrency(day.tradeTakenInAmount)} (${day.tradeTakenInCount})` : '')
      );
    }
  }

  lines.push(
    ``,
    `Note: Sales & trade ledger figures represent gross totals before commission reductions unless a commission rate is applied above.`
  );

  return lines.join('\n');
}

export function downloadVendorSettlementPdf(
  details: VendorWeekDetails,
  commissionPercent: number,
  dayEventsByDate?: Map<string, DayEventInfo>
): void {
  const calc = calculateVendorSettlement(details, commissionPercent);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  // Header Banner
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`VENDOR WEEKLY SETTLEMENT STATEMENT`, margin + 5, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(212, 212, 216);
  doc.text(`Vendor: ${details.vendorName}   •   ${details.weekInfo.label}`, margin + 5, y + 16);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 5, y + 16, {
    align: 'right',
  });

  y += 31;

  // Two-column summary boxes: Sales Breakdown & Trade-Ins
  const boxW = (contentWidth - 6) / 2;
  const boxH = 44;

  // Sales Box
  doc.setDrawColor(228, 228, 231);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(margin, y, boxW, boxH, 2.5, 2.5, 'FD');

  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`GROSS SALES (${details.salesCount} sales)`, margin + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(63, 63, 70);
  const salesRows: [string, string][] = [
    [`Cash Sales (${details.cashCount})`, formatCurrency(details.cashRevenue)],
    [`Card Sales (${details.cardCount})`, formatCurrency(details.cardRevenue)],
    [`Online Sales (${details.onlineCount || 0})`, formatCurrency(details.onlineRevenue || 0)],
    [`Traded Out (${details.tradedOutCount})`, formatCurrency(details.tradedOutRevenue)],
  ];
  let sy = y + 14;
  for (const [label, val] of salesRows) {
    doc.text(label, margin + 4, sy);
    doc.text(val, margin + boxW - 4, sy, { align: 'right' });
    sy += 6;
  }
  doc.setDrawColor(212, 212, 216);
  doc.line(margin + 4, sy - 2, margin + boxW - 4, sy - 2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(`Gross Sales Total`, margin + 4, sy + 3);
  doc.text(formatCurrency(calc.grossSales), margin + boxW - 4, sy + 3, { align: 'right' });

  // Trades & Settlement Box
  const rightX = margin + boxW + 6;
  doc.setDrawColor(228, 228, 231);
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(rightX, y, boxW, boxH, 2.5, 2.5, 'FD');

  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`TRADES & SETTLEMENT PREVIEW`, rightX + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(63, 63, 70);
  let ty = y + 14;
  const settleRows: [string, string][] = [
    [`Cash Trades Out (${details.cashTradeCount})`, `-${formatCurrency(calc.cashTradesPaidOut)}`],
    [`Vendor Credit (${details.creditTradeCount})`, formatCurrency(calc.creditTradesIssued)],
    [
      calc.commissionPercent > 0 ? `Commission (${calc.commissionPercent}%)` : `Commission Rate`,
      calc.commissionPercent > 0 ? `-${formatCurrency(calc.commissionAmount)}` : `0% (Gross)`,
    ],
    [`Sales After Comm.`, formatCurrency(calc.netSalesAfterCommission)],
  ];
  for (const [label, val] of settleRows) {
    doc.text(label, rightX + 4, ty);
    doc.text(val, rightX + boxW - 4, ty, { align: 'right' });
    ty += 6;
  }
  doc.setDrawColor(245, 158, 11);
  doc.line(rightX + 4, ty - 2, rightX + boxW - 4, ty - 2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text(calc.commissionPercent > 0 ? `Net Settlement` : `Gross Less Cash Trades`, rightX + 4, ty + 3);
  doc.text(formatCurrency(calc.netSettlementDue), rightX + boxW - 4, ty + 3, { align: 'right' });

  y += boxH + 8;

  // Daily Breakdown Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(24, 24, 27);
  doc.text(`DAILY BREAKDOWN (SUN – SAT)`, margin, y);
  y += 4;

  // Table header
  doc.setFillColor(244, 244, 245);
  doc.rect(margin, y, contentWidth, 7.5, 'F');
  doc.setFontSize(8);
  doc.setTextColor(82, 82, 91);
  doc.text('DAY', margin + 3, y + 5);
  doc.text('SALES', margin + 62, y + 5, { align: 'right' });
  doc.text('CASH', margin + 88, y + 5, { align: 'right' });
  doc.text('CARD', margin + 112, y + 5, { align: 'right' });
  doc.text('ONLINE', margin + 136, y + 5, { align: 'right' });
  doc.text('TRADE OUT', margin + 159, y + 5, { align: 'right' });
  doc.text('TRADES IN', margin + contentWidth - 3, y + 5, { align: 'right' });
  y += 8.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  for (const day of details.dayBreakdown) {
    const ev = dayEventsByDate?.get(day.dateKey);
    const dayLabel = `${day.dayName} ${day.formattedDate}${ev?.isEvent && ev.eventName ? ` (${ev.eventName.slice(0, 14)})` : ''}`;

    doc.setTextColor(24, 24, 27);
    doc.text(dayLabel, margin + 3, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${formatCurrency(day.totalRevenue)} (${day.salesCount})`, margin + 62, y + 4.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(63, 63, 70);
    doc.text(formatCurrency(day.cashRevenue), margin + 88, y + 4.5, { align: 'right' });
    doc.text(formatCurrency(day.cardRevenue), margin + 112, y + 4.5, { align: 'right' });
    doc.text(formatCurrency(day.onlineRevenue || 0), margin + 136, y + 4.5, { align: 'right' });
    doc.text(formatCurrency(day.tradedOutRevenue), margin + 159, y + 4.5, { align: 'right' });
    doc.text(
      day.tradeTakenInCount > 0 ? `${formatCurrency(day.tradeTakenInAmount)} (${day.tradeTakenInCount})` : '—',
      margin + contentWidth - 3,
      y + 4.5,
      { align: 'right' }
    );

    doc.setDrawColor(244, 244, 245);
    doc.line(margin, y + 6.5, margin + contentWidth, y + 6.5);
    y += 7;
  }

  y += 5;

  // Individual Sales List (compact, up to 24 rows fitting on page 1 or paginating cleanly)
  if (details.sales.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(24, 24, 27);
    doc.text(`ITEMIZED SALES (${details.sales.length})`, margin, y);
    y += 5;

    doc.setFillColor(244, 244, 245);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFontSize(8);
    doc.setTextColor(82, 82, 91);
    doc.text('DATE', margin + 3, y + 4.8);
    doc.text('ITEM SOLD', margin + 30, y + 4.8);
    doc.text('METHOD', margin + 142, y + 4.8);
    doc.text('GROSS (£)', margin + contentWidth - 3, y + 4.8, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);

    for (const sale of details.sales) {
      if (y > 274) {
        doc.addPage();
        y = 18;
      }
      const methodLabel =
        sale.paymentMethod === 'traded_out'
          ? 'TRADE OUT'
          : sale.paymentMethod === 'online'
          ? 'ONLINE'
          : sale.paymentMethod.toUpperCase();
      const itemLabel =
        sale.itemDescription.length > 56 ? `${sale.itemDescription.slice(0, 54)}...` : sale.itemDescription;

      doc.setTextColor(82, 82, 91);
      doc.text(sale.dateKey, margin + 3, y + 4);
      doc.setTextColor(24, 24, 27);
      doc.text(itemLabel, margin + 30, y + 4);
      doc.setTextColor(82, 82, 91);
      doc.text(methodLabel, margin + 142, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 27);
      doc.text(formatCurrency(sale.amount), margin + contentWidth - 3, y + 4, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      doc.setDrawColor(244, 244, 245);
      doc.line(margin, y + 5.8, margin + contentWidth, y + 5.8);
      y += 6.2;
    }
  }

  // Disclaimer Footer
  if (y > 278) {
    doc.addPage();
    y = 20;
  } else {
    y += 6;
  }
  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122);
  doc.text(
    'All gross sales figures and trade valuations recorded in the ledger are before commission reductions.',
    margin,
    y
  );

  const safeVendor = details.vendorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`settlement-${safeVendor}-${details.weekInfo.startDateKey}-to-${details.weekInfo.endDateKey}.pdf`);
}
