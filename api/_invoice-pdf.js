// Renders a Stripe invoice as a PDF matching the site's dark/red visual
// identity, replacing Stripe's own (plain white) invoice PDF. Pure JS
// (pdfkit), no headless browser — cheap and fast on Vercel's serverless
// runtime.
const PDFDocument = require('pdfkit');

const BRAND = {
  bg: '#0e0f10',
  card: '#141516',
  accent: '#E4232B',
  border: '#2a1416',
  heading: '#F7F7F7',
  body: '#c8ccd0',
  muted: '#9aa0a4',
  label: '#7c8085'
};

const BUSINESS = {
  name: 'Ecrin Wrap',
  addressLines: ['Rue De La Porte Aux Champs 9', '4210 Burdinne', 'Belgique'],
  phone: '+32 474 63 82 61'
};

const LOGO_URL = 'https://ecrin-wrap.vercel.app/assets/ecrin-logo.png';

async function fetchLogo() {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return null;
  }
}

function money(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

// Stripe auto-generates line descriptions like "1 × Plan (at €19.00/month)" —
// strip the redundant qty/price parenthetical since we already show those
// in their own table columns.
function cleanDescription(desc, qty) {
  if (!desc) return '';
  let d = desc.replace(/\s*\((?:à|at)\s.+?\)\s*$/i, '');
  if (qty === 1) d = d.replace(/^1\s*[×x]\s*/i, '');
  return d.trim();
}

function formatDate(unixSeconds) {
  if (!unixSeconds) return '';
  return new Date(unixSeconds * 1000).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function generateInvoicePdf(invoice) {
  const logoBuffer = await fetchLogo();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 20, left: 50, right: 50 } });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const marginX = 50;
    const contentWidth = pageWidth - marginX * 2;

    // full-page dark background
    doc.rect(0, 0, pageWidth, pageHeight).fill(BRAND.bg);

    // header: logo + "FACTURE" title
    let y = 50;
    let logoHeight = 0;
    if (logoBuffer) {
      try {
        const logoWidth = 90;
        const img = doc.openImage(logoBuffer);
        logoHeight = (img.height / img.width) * logoWidth;
        doc.image(logoBuffer, marginX, y, { width: logoWidth });
      } catch (e) { /* skip if unreadable */ }
    }
    doc.fillColor(BRAND.heading).font('Helvetica-Bold').fontSize(26)
      .text('Facture', marginX, y + 6, { width: contentWidth, align: 'right' });

    y += Math.max(logoHeight, 30) + 20;
    doc.moveTo(marginX, y).lineTo(pageWidth - marginX, y).lineWidth(1).strokeColor(BRAND.accent).stroke();
    y += 28;

    // meta (left) + biller/customer (right)
    const colWidth = contentWidth / 2 - 10;
    const metaY = y;

    doc.font('Helvetica').fontSize(9).fillColor(BRAND.label);
    doc.text('NUMÉRO DE FACTURE', marginX, metaY);
    doc.text('DATE D’ÉMISSION', marginX, metaY + 18);
    doc.text('DATE D’ÉCHÉANCE', marginX, metaY + 36);

    doc.font('Helvetica').fontSize(10).fillColor(BRAND.body);
    doc.text(invoice.number || invoice.id, marginX + 140, metaY);
    doc.text(formatDate(invoice.created), marginX + 140, metaY + 18);
    doc.text(formatDate(invoice.due_date || invoice.created), marginX + 140, metaY + 36);

    const rightColX = marginX + colWidth + 20;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.heading).text(BUSINESS.name, rightColX, metaY);
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted);
    BUSINESS.addressLines.forEach((line, i) => doc.text(line, rightColX, metaY + 16 + i * 13));
    doc.text(BUSINESS.phone, rightColX, metaY + 16 + BUSINESS.addressLines.length * 13);

    const custY = metaY + 16 + BUSINESS.addressLines.length * 13 + 26;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.label).text('FACTURER À', rightColX, custY);
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.body).text(invoice.customer_email || '', rightColX, custY + 15);

    y = custY + 50;

    // amount due
    doc.font('Helvetica-Bold').fontSize(15).fillColor(BRAND.heading)
      .text(money(invoice.amount_paid) + ' payés le ' + formatDate(invoice.status_transitions && invoice.status_transitions.paid_at || invoice.created), marginX, y);
    y += 36;

    // line items table
    const cols = { desc: marginX, qty: marginX + 300, unit: marginX + 360, amount: marginX + 450 };
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.accent);
    doc.text('DESCRIPTION', cols.desc, y);
    doc.text('QTÉ', cols.qty, y);
    doc.text('PRIX UNIT.', cols.unit, y);
    doc.text('MONTANT', cols.amount, y, { width: pageWidth - marginX - cols.amount, align: 'right' });
    y += 16;
    doc.moveTo(marginX, y).lineTo(pageWidth - marginX, y).lineWidth(0.5).strokeColor(BRAND.border).stroke();
    y += 12;

    const lines = (invoice.lines && invoice.lines.data) || [];
    lines.forEach((line) => {
      const qty = line.quantity || 1;
      const unitAmount = qty ? Math.round(line.amount / qty) : line.amount;
      doc.font('Helvetica').fontSize(10).fillColor(BRAND.body);
      doc.text(cleanDescription(line.description, qty), cols.desc, y, { width: cols.qty - cols.desc - 10 });
      doc.text(String(qty), cols.qty, y);
      doc.text(money(unitAmount), cols.unit, y);
      doc.text(money(line.amount), cols.amount, y, { width: pageWidth - marginX - cols.amount, align: 'right' });
      if (line.period && line.period.start && line.period.end) {
        doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted)
          .text(formatDate(line.period.start) + ' – ' + formatDate(line.period.end), cols.desc, y + 14);
      }
      y += 34;
    });

    y += 6;
    doc.moveTo(marginX, y).lineTo(pageWidth - marginX, y).lineWidth(0.5).strokeColor(BRAND.border).stroke();
    y += 14;

    const totalsX = cols.unit;
    const totalsLabelWidth = cols.amount - totalsX - 10;
    const rowH = 18;
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.muted);
    doc.text('Sous-total', totalsX, y, { width: totalsLabelWidth, align: 'left' });
    doc.fillColor(BRAND.body).text(money(invoice.subtotal), cols.amount, y, { width: pageWidth - marginX - cols.amount, align: 'right' });
    y += rowH;
    doc.fillColor(BRAND.muted).text('Total', totalsX, y, { width: totalsLabelWidth, align: 'left' });
    doc.fillColor(BRAND.body).text(money(invoice.total), cols.amount, y, { width: pageWidth - marginX - cols.amount, align: 'right' });
    y += rowH;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.accent).text('Montant payé', totalsX, y, { width: totalsLabelWidth, align: 'left' });
    doc.fillColor(BRAND.heading).text(money(invoice.amount_paid), cols.amount, y, { width: pageWidth - marginX - cols.amount, align: 'right' });

    // footer
    const footerY = pageHeight - 80;
    doc.moveTo(marginX, footerY).lineTo(pageWidth - marginX, footerY).lineWidth(0.5).strokeColor(BRAND.border).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(BRAND.label)
      .text('COVERING · PPF · DETAILING — VILLERS-LE-BOUILLET, BELGIQUE', marginX, footerY + 14, { width: contentWidth, align: 'center' });
    doc.fontSize(7.5).fillColor('#454749')
      .text('Facture générée automatiquement suite à un paiement sur ecrin-wrap.vercel.app.', marginX, footerY + 28, { width: contentWidth, align: 'center' });

    doc.end();
  });
}

module.exports = { generateInvoicePdf };
