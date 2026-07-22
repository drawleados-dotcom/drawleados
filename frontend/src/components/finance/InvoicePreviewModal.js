import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import api from '../../utils/api';
import { Download, Printer, Mail } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

const InvoicePreviewModal = ({ invoice, onClose }) => {
  const [companyProfile, setCompanyProfile] = useState(null);

  useEffect(() => {
    fetchCompanyProfile();
  }, []);

  const fetchCompanyProfile = async () => {
    try {
      const response = await api.get('/company-profile');
      setCompanyProfile(response.data);
    } catch (error) {
      console.error('Error fetching company profile:', error);
    }
  };

  // ---------- helpers ----------
  const hexToRgb = (hex) => {
    const h = (hex || '#F97316').replace('#', '');
    const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [
      parseInt(f.substring(0, 2), 16),
      parseInt(f.substring(2, 4), 16),
      parseInt(f.substring(4, 6), 16),
    ];
  };

  const formatCurrencyINR = (n) => {
    const v = Number(n || 0);
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDateDDMMYYYY = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };

  // Indian-style number to words (e.g., 1,18,000 -> "Indian Rupee One Lakh Eighteen Thousand Only")
  const numberToWordsIndian = (num) => {
    if (num == null || isNaN(num)) return '';
    const n = Math.floor(Number(num));
    if (n === 0) return 'Indian Rupee Zero Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const twoDigit = (x) => {
      if (x === 0) return '';
      if (x < 20) return ones[x];
      const t = Math.floor(x / 10), o = x % 10;
      return tens[t] + (o ? ' ' + ones[o] : '');
    };
    const threeDigit = (x) => {
      const h = Math.floor(x / 100), rest = x % 100;
      let s = '';
      if (h) s += ones[h] + ' Hundred';
      if (rest) s += (s ? ' ' : '') + twoDigit(rest);
      return s;
    };
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n / 100000) % 100);
    const thousand = Math.floor((n / 1000) % 100);
    const hundred = n % 1000;
    let words = '';
    if (crore) words += twoDigit(crore) + ' Crore ';
    if (lakh) words += twoDigit(lakh) + ' Lakh ';
    if (thousand) words += twoDigit(thousand) + ' Thousand ';
    if (hundred) words += threeDigit(hundred);
    return 'Indian Rupee ' + words.trim().replace(/\s+/g, ' ') + ' Only';
  };

  const handleDownloadPDF = async () => {
    const themeColor = companyProfile?.invoice_theme_color || '#F97316';
    const [tr, tg, tb] = hexToRgb(themeColor);
    const signatureLabel = companyProfile?.invoice_signature_label || 'Authorized Signature';
    const logoUrl = companyProfile?.logo_url || '';
    const logoWidth = Number(companyProfile?.invoice_logo_width_mm) || 35;
    const logoHeightCfg = Number(companyProfile?.invoice_logo_height_mm) || 0;
    const signatureImageUrl = companyProfile?.invoice_signature_image || '';
    const signatureWidth = Number(companyProfile?.invoice_signature_width_mm) || 40;

    // Load an image URL (or data URL) into a usable data URL with natural dims.
    const loadImage = async (src, targetWidth) => {
      if (!src) return null;
      try {
        let dataUrl = src;
        if (!src.startsWith('data:')) {
          const resp = await fetch(src, { mode: 'cors' });
          const blob = await resp.blob();
          dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
        const dims = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const ratio = img.naturalHeight / img.naturalWidth || 0.4;
            resolve({ w: targetWidth, h: targetWidth * ratio });
          };
          img.onerror = () => resolve({ w: targetWidth, h: targetWidth * 0.4 });
          img.src = dataUrl;
        });
        return { dataUrl, ...dims };
      } catch {
        return null;
      }
    };

    // Preload logo as a data URL and get natural dimensions to honor aspect ratio.
    let logoData = null;
    let logoDims = { w: logoWidth, h: 0 };
    if (logoUrl) {
      try {
        // If logoUrl is already a data URL, use it directly; otherwise fetch and convert.
        let dataUrl = logoUrl;
        if (!logoUrl.startsWith('data:')) {
          const resp = await fetch(logoUrl, { mode: 'cors' });
          const blob = await resp.blob();
          dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
        // Probe natural size for aspect ratio
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const ratio = img.naturalHeight / img.naturalWidth || 0.4;
            logoDims = {
              w: logoWidth,
              h: logoHeightCfg > 0 ? logoHeightCfg : logoWidth * ratio,
            };
            resolve();
          };
          img.onerror = () => resolve();
          img.src = dataUrl;
        });
        logoData = dataUrl;
      } catch {
        // Silently skip the logo if it cannot be loaded (e.g. CORS / 404)
        logoData = null;
      }
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();   // 210
    const pageH = doc.internal.pageSize.getHeight();  // 297
    const M = 14; // margin
    const contentW = pageW - 2 * M;

    // ============ TOP SECTION ============
    // Left: TAX INVOICE + invoice number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(45, 45, 45);
    doc.text('TAX INVOICE', M, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    doc.text(`# ${invoice.invoice_number || ''}`, M, 29);

    // Right: LOGO (if available) + Company info
    let rightY = 14;
    if (logoData && logoDims.h > 0) {
      try {
        const logoX = pageW - M - logoDims.w;
        doc.addImage(logoData, 'PNG', logoX, rightY, logoDims.w, logoDims.h, undefined, 'FAST');
        rightY += logoDims.h + 3;
      } catch {
        // ignore image errors
      }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(45, 45, 45);
    const companyName = companyProfile?.company_name || 'Your Company';
    doc.text(companyName, pageW - M, rightY + 2, { align: 'right' });
    rightY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const addrParts = [
      companyProfile?.address,
      [companyProfile?.city, companyProfile?.state].filter(Boolean).join(', '),
      [companyProfile?.pincode, companyProfile?.country].filter(Boolean).join(' '),
    ].filter(Boolean);
    addrParts.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, 90);
      wrapped.forEach((w) => {
        doc.text(w, pageW - M, rightY, { align: 'right' });
        rightY += 4.2;
      });
    });
    if (companyProfile?.gst_number) {
      doc.text(`GSTIN ${companyProfile.gst_number}`, pageW - M, rightY, { align: 'right' });
      rightY += 4.2;
    }
    if (companyProfile?.phone) {
      doc.text(companyProfile.phone, pageW - M, rightY, { align: 'right' });
      rightY += 4.2;
    }
    if (companyProfile?.email) {
      doc.text(companyProfile.email, pageW - M, rightY, { align: 'right' });
      rightY += 4.2;
    }

    // Theme color strip
    const stripY = Math.max(rightY + 2, 50);
    doc.setFillColor(tr, tg, tb);
    doc.rect(0, stripY, pageW, 1.5, 'F');

    // ============ BILL TO / SHIP TO  +  META TABLE ============
    let leftY = stripY + 10;
    let metaY = stripY + 10;

    // Bill To (LEFT)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(45, 45, 45);
    doc.text('Bill To', M, leftY);
    leftY += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(invoice.client_name || '—', M, leftY);
    leftY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    if (invoice.client_address) {
      const wrapped = doc.splitTextToSize(invoice.client_address, 80);
      wrapped.forEach((w) => { doc.text(w, M, leftY); leftY += 4.2; });
    }
    if (invoice.client_gst_number) {
      doc.text(`GSTIN ${invoice.client_gst_number}`, M, leftY);
      leftY += 4.2;
    }

    // Ship To (under Bill To)
    leftY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(45, 45, 45);
    doc.text('Ship To', M, leftY);
    leftY += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(invoice.client_name || '—', M, leftY);
    leftY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    if (invoice.client_address) {
      const wrapped = doc.splitTextToSize(invoice.client_address, 80);
      wrapped.forEach((w) => { doc.text(w, M, leftY); leftY += 4.2; });
    }
    if (invoice.client_gst_number) {
      doc.text(`GSTIN ${invoice.client_gst_number}`, M, leftY);
      leftY += 4.2;
    }

    // META TABLE (RIGHT) — Invoice Date / Terms / Due Date / Place Of Supply
    const metaX = pageW - M - 75;
    const metaLines = [
      ['Invoice Date :', formatDateDDMMYYYY(invoice.invoice_date)],
      ['Terms :', invoice.payment_terms || 'Due on Receipt'],
      ['Due Date :', formatDateDDMMYYYY(invoice.due_date)],
    ];
    if (invoice.client_place_of_supply || invoice.place_of_supply) {
      metaLines.push(['Place Of Supply :', invoice.client_place_of_supply || invoice.place_of_supply]);
    }
    doc.setFontSize(9.5);
    metaLines.forEach(([k, v]) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(45, 45, 45);
      doc.text(k, metaX, metaY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(String(v || ''), pageW - M, metaY, { align: 'right' });
      metaY += 6;
    });

    const tableStartY = Math.max(leftY, metaY) + 6;

    // ============ ITEM TABLE ============
    const items = invoice.items || [];
    const tableHead = [[
      '#', 'Item & Description', 'HSN/SAC', 'Qty', 'Rate', 'Discount',
      'CGST',
      'SGST',
      'Amount',
    ]];
    const tableBody = items.map((it, i) => {
      const qty = Number(it.quantity || 0);
      const rate = Number(it.rate || 0);
      const discPct = Number(it.discount_percent ?? it.discount_percentage ?? 0);
      const gstRate = Number(it.gst_rate ?? it.gst_percentage ?? 0);
      const base = qty * rate;
      const discAmt = (base * discPct) / 100;
      const taxable = base - discAmt;
      const halfGst = gstRate / 2;
      const cgstAmt = (taxable * halfGst) / 100;
      const sgstAmt = (taxable * halfGst) / 100;
      const amount = taxable + cgstAmt + sgstAmt;
      const descBlock = [
        it.service_name || it.description || '',
        it.description && it.service_name && it.description !== it.service_name ? it.description : '',
      ].filter(Boolean).join('\n');
      return [
        String(i + 1),
        descBlock,
        it.hsn_sac || '—',
        formatCurrencyINR(qty),
        formatCurrencyINR(rate),
        discPct ? `${formatCurrencyINR(discAmt)}\n(${discPct}%)` : '0.00',
        halfGst ? `${formatCurrencyINR(cgstAmt)}\n(${halfGst}%)` : '0.00\n(0%)',
        halfGst ? `${formatCurrencyINR(sgstAmt)}\n(${halfGst}%)` : '0.00\n(0%)',
        formatCurrencyINR(amount),
      ];
    });

    autoTable(doc, {
      startY: tableStartY,
      head: tableHead,
      body: tableBody,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.1, textColor: [50, 50, 50] },
      headStyles: {
        fillColor: [tr, tg, tb], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', valign: 'middle',
        fontSize: 8.5, cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 50, halign: 'left' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 14, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 20, halign: 'right' },
        7: { cellWidth: 20, halign: 'right' },
        8: { cellWidth: 22, halign: 'right' },
      },
      margin: { left: M, right: M },
    });

    let afterTableY = (doc.lastAutoTable?.finalY || tableStartY) + 6;

    // ============ TOTALS BOX (right) ============
    // Always recompute from items so the PDF is self-consistent even for legacy
    // invoices that were stored with incorrect totals.
    let computedSubTotal = 0;
    let computedDiscount = 0;
    let computedCgst = 0;
    let computedSgst = 0;
    items.forEach((it) => {
      const qty = Number(it.quantity || 0);
      const rate = Number(it.rate || 0);
      const discPct = Number(it.discount_percent ?? it.discount_percentage ?? 0);
      const gstRate = Number(it.gst_rate ?? it.gst_percentage ?? 0);
      const base = qty * rate;
      const disc = (base * discPct) / 100;
      const taxable = base - disc;
      const half = gstRate / 2;
      computedSubTotal += base;
      computedDiscount += disc;
      computedCgst += (taxable * half) / 100;
      computedSgst += (taxable * half) / 100;
    });
    const subTotal = computedSubTotal;
    const totalDiscount = computedDiscount;
    const cgstTotal = computedCgst;
    const sgstTotal = computedSgst;
    const igstTotal = 0; // intra-state only for now
    const totalAmount = (subTotal - totalDiscount) + cgstTotal + sgstTotal + igstTotal;

    // Pick a label rate (first non-zero gst_rate / 2)
    const firstGstHalf = (() => {
      const it = items.find((x) => Number(x.gst_rate ?? x.gst_percentage ?? 0) > 0);
      const r = Number(it?.gst_rate ?? it?.gst_percentage ?? 0) / 2;
      return r || 9;
    })();

    const balanceDue = totalAmount - Number(invoice.paid_amount || 0);

    const totalsLeftX = pageW - M - 75;
    let y = afterTableY;
    const drawTotalsRow = (label, value, opts = {}) => {
      const { bold = false, large = false, bg = false, color = null } = opts;
      if (bg) {
        doc.setFillColor(245, 245, 245);
        doc.rect(totalsLeftX - 2, y - 4, 75 + 2, 7, 'F');
      }
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(large ? 11 : 9.5);
      doc.setTextColor(...(color || [60, 60, 60]));
      doc.text(label, totalsLeftX, y);
      doc.text(value, pageW - M, y, { align: 'right' });
      y += large ? 7 : 6;
    };

    drawTotalsRow('Sub Total', formatCurrencyINR(subTotal));
    if (totalDiscount > 0) drawTotalsRow('Discount', `-${formatCurrencyINR(totalDiscount)}`);
    if (cgstTotal > 0) drawTotalsRow(`CGST${firstGstHalf} (${firstGstHalf}%)`, formatCurrencyINR(cgstTotal));
    if (sgstTotal > 0) drawTotalsRow(`SGST${firstGstHalf} (${firstGstHalf}%)`, formatCurrencyINR(sgstTotal));
    if (igstTotal > 0) drawTotalsRow(`IGST (${firstGstHalf * 2}%)`, formatCurrencyINR(igstTotal));

    // Total row (theme)
    doc.setFillColor(tr, tg, tb);
    doc.rect(totalsLeftX - 2, y - 4, 75 + 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('Total', totalsLeftX, y + 0.5);
    doc.text(`Rs.${formatCurrencyINR(totalAmount)}`, pageW - M, y + 0.5, { align: 'right' });
    y += 9;

    drawTotalsRow('Balance Due', `Rs.${formatCurrencyINR(balanceDue)}`, { bold: true, color: [45, 45, 45] });

    afterTableY = y + 6;

    // Total In Words
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(45, 45, 45);
    doc.text('Total In Words :', M, afterTableY);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(60, 60, 60);
    const wordsLines = doc.splitTextToSize(numberToWordsIndian(totalAmount), contentW - 35);
    doc.text(wordsLines, M + 33, afterTableY);
    afterTableY += 4.5 * wordsLines.length + 6;

    // ============ NOTES (LEFT) + SIGNATURE (RIGHT) ============
    const notesY = Math.max(afterTableY, pageH - 65);
    if (invoice.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(45, 45, 45);
      doc.text('Notes', M, notesY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const noteLines = doc.splitTextToSize(invoice.notes, 100);
      doc.text(noteLines, M, notesY + 5);
    }

    // Terms & Conditions
    const termsText = invoice.terms_and_conditions || companyProfile?.terms_conditions;
    if (termsText) {
      const tY = notesY + (invoice.notes ? 22 : 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(45, 45, 45);
      doc.text('Terms & Conditions', M, tY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      const tLines = doc.splitTextToSize(termsText, 100);
      doc.text(tLines.slice(0, 4), M, tY + 5);
    }

    // Signature (right)
    const sigY = pageH - 35;
    // Render signature image just above the line if available
    const sigImg = await loadImage(signatureImageUrl, signatureWidth);
    if (sigImg) {
      try {
        const sigImgX = pageW - M - sigImg.w;
        const sigImgY = sigY - sigImg.h - 1;
        doc.addImage(sigImg.dataUrl, 'PNG', sigImgX, sigImgY, sigImg.w, sigImg.h, undefined, 'FAST');
      } catch {
        // ignore
      }
    }
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(pageW - M - 55, sigY, pageW - M, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(45, 45, 45);
    doc.text(signatureLabel, pageW - M, sigY + 5, { align: 'right' });

    // Footer
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(M, pageH - 18, pageW - M, pageH - 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Generated by ${companyName} OS`, M, pageH - 12);
    doc.text(`Page 1 of 1`, pageW - M, pageH - 12, { align: 'right' });

    doc.save(`${invoice.invoice_number || 'invoice'}.pdf`);
    toast.success('Invoice PDF downloaded');
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate totals for display
  const calculateItemTotal = (item) => {
    const baseAmount = item.quantity * item.rate;
    const discountAmount = (baseAmount * (item.discount_percentage || 0)) / 100;
    const afterDiscount = baseAmount - discountAmount;
    const gstAmount = (afterDiscount * (item.gst_percentage || 0)) / 100;
    return afterDiscount + gstAmount;
  };

  const fullAddress = companyProfile ? [
    companyProfile.address,
    companyProfile.city,
    companyProfile.state,
    companyProfile.pincode
  ].filter(Boolean).join(', ') : '';

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Invoice Preview</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handlePrint}
                className="bg-gray-100 dark:bg-[#27272a] hover:bg-gray-200 dark:hover:bg-[#3f3f46] text-gray-900 dark:text-[#fafafa]"
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadPDF}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="download-invoice-pdf"
              >
                <Download className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Invoice Preview */}
        <div className="bg-white text-black p-8 rounded-lg print:shadow-none" id="invoice-preview">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              {companyProfile?.logo_url && (
                <img
                  src={companyProfile.logo_url}
                  alt="Company Logo"
                  className="h-12 mb-2"
                  onError={(e) => (e.target.style.display = 'none')}
                />
              )}
              <h1 className="text-2xl font-bold text-[#6366f1]">
                {companyProfile?.company_name || 'Your Company'}
              </h1>
              {fullAddress && <p className="text-sm text-gray-600 mt-1">{fullAddress}</p>}
              {companyProfile?.gst_number && (
                <p className="text-sm text-gray-600">GSTIN: {companyProfile.gst_number}</p>
              )}
              {companyProfile?.pan_number && (
                <p className="text-sm text-gray-600">PAN: {companyProfile.pan_number}</p>
              )}
              {companyProfile?.phone && (
                <p className="text-sm text-gray-600">Phone: {companyProfile.phone}</p>
              )}
              {companyProfile?.email && (
                <p className="text-sm text-gray-600">Email: {companyProfile.email}</p>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold text-[#6366f1]">INVOICE</h2>
              <p className="text-sm text-gray-600 mt-2">#{invoice.invoice_number}</p>
              <p className="text-sm text-gray-600">
                Date: {new Date(invoice.invoice_date).toLocaleDateString('en-IN')}
              </p>
              {invoice.due_date && (
                <p className="text-sm text-gray-600">
                  Due: {new Date(invoice.due_date).toLocaleDateString('en-IN')}
                </p>
              )}
              <span
                className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{
                  backgroundColor:
                    invoice.status === 'paid'
                      ? '#10b981'
                      : invoice.status === 'overdue'
                      ? '#ef4444'
                      : invoice.status === 'sent'
                      ? '#3b82f6'
                      : '#a1a1aa',
                }}
              >
                {invoice.status?.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-8">
            <p className="text-xs text-gray-500 uppercase mb-1">Bill To</p>
            <p className="font-semibold text-lg">{invoice.client_name}</p>
            {invoice.client_address && <p className="text-sm text-gray-600">{invoice.client_address}</p>}
            {invoice.client_gst_number && (
              <p className="text-sm text-gray-600">GSTIN: {invoice.client_gst_number}</p>
            )}
          </div>

          {/* Items Table */}
          <div className="mb-8 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#6366f1] text-white">
                  <th className="p-3 text-left text-sm">#</th>
                  <th className="p-3 text-left text-sm">Description</th>
                  <th className="p-3 text-center text-sm">Qty</th>
                  <th className="p-3 text-right text-sm">Rate</th>
                  <th className="p-3 text-center text-sm">Discount</th>
                  <th className="p-3 text-center text-sm">GST</th>
                  <th className="p-3 text-right text-sm">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="p-3 text-sm">{i + 1}</td>
                    <td className="p-3 text-sm">{item.service_name || item.description}</td>
                    <td className="p-3 text-sm text-center">{item.quantity}</td>
                    <td className="p-3 text-sm text-right">₹{item.rate.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-sm text-center">
                      {item.discount_percentage ? `${item.discount_percentage}%` : '-'}
                    </td>
                    <td className="p-3 text-sm text-center">
                      {item.gst_percentage ? `${item.gst_percentage}%` : '-'}
                    </td>
                    <td className="p-3 text-sm text-right font-medium">
                      ₹{calculateItemTotal(item).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64">
              <div className="flex justify-between py-2 text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span>₹{(invoice.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between py-2 text-sm text-red-600">
                  <span>Discount:</span>
                  <span>-₹{invoice.discount_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {invoice.gst_amount > 0 && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-gray-600">GST ({invoice.gst_type?.toUpperCase()}):</span>
                  <span>₹{invoice.gst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between py-3 text-lg font-bold border-t-2 border-[#6366f1] mt-2">
                <span className="text-[#6366f1]">TOTAL:</span>
                <span>₹{(invoice.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-8 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-600">{invoice.notes}</p>
            </div>
          )}

          {/* Bank Details & UPI */}
          {(companyProfile?.bank_details?.account_number || companyProfile?.upi_ids?.length > 0) && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              {companyProfile?.bank_details?.account_number && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase mb-2">Bank Details</p>
                  {companyProfile.bank_details.bank_name && (
                    <p className="text-sm"><span className="text-gray-500">Bank:</span> {companyProfile.bank_details.bank_name}</p>
                  )}
                  {companyProfile.bank_details.account_name && (
                    <p className="text-sm"><span className="text-gray-500">Name:</span> {companyProfile.bank_details.account_name}</p>
                  )}
                  <p className="text-sm"><span className="text-gray-500">A/C:</span> {companyProfile.bank_details.account_number}</p>
                  {companyProfile.bank_details.ifsc_code && (
                    <p className="text-sm"><span className="text-gray-500">IFSC:</span> {companyProfile.bank_details.ifsc_code}</p>
                  )}
                </div>
              )}
              {companyProfile?.upi_ids?.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase mb-2">UPI Payment</p>
                  {companyProfile.upi_ids.map((upi, i) => (
                    <p key={i} className="text-sm font-medium text-[#6366f1]">{upi}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Terms & Conditions */}
          {companyProfile?.terms_conditions && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 uppercase mb-1">Terms & Conditions</p>
              <p className="text-xs text-gray-500 whitespace-pre-line">{companyProfile.terms_conditions}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 text-center text-sm text-gray-500">
            Thank you for your business!
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoicePreviewModal;
