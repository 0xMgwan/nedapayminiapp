import { NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import prisma from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { lineItems: true, paymentLink: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    const contentWidth = pageWidth - 2 * margin;

    // Set default font
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    // Header with gradient
    doc.setDrawColor('#7c3aed');
    doc.setFillColor('#7c3aed');
    doc.rect(0, 0, pageWidth, 120, 'FD');
    
    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', margin, 70);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Payment Request', margin, 90);

    // Invoice ID
    doc.setFontSize(10);
    doc.text('Invoice ID', pageWidth - margin, 60, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`#${invoice.id.slice(0, 8)}`, pageWidth - margin, 80, { align: 'right' });

    let yPosition = 150;

    // Status Banner
    type StatusColors = {
      bg: [number, number, number];
      text: [number, number, number];
    };

    const getStatusColor = (status: string): StatusColors => {
      switch (status.toLowerCase()) {
        case 'paid': return { bg: [220, 252, 231], text: [21, 128, 61] };
        case 'overdue': return { bg: [254, 226, 226], text: [185, 28, 28] };
        case 'outstanding': return { bg: [219, 234, 254], text: [29, 78, 216] };
        case 'sent': return { bg: [255, 237, 213], text: [194, 65, 12] };
        case 'draft': return { bg: [243, 244, 246], text: [55, 65, 81] };
        case 'partial': return { bg: [254, 249, 195], text: [161, 98, 7] };
        default: return { bg: [243, 244, 246], text: [55, 65, 81] };
      }
    };

    const statusColors = getStatusColor(invoice.status);
    doc.setFillColor(...statusColors.bg);
    doc.rect(margin, yPosition, contentWidth, 40, 'F');
    doc.setDrawColor(103, 58, 183);
    doc.setLineWidth(3);
    doc.line(margin, yPosition, margin, yPosition + 40);
    
    doc.setTextColor(...statusColors.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Invoice Status', margin + 20, yPosition + 20);
    doc.setFontSize(14);
    doc.text(
      invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1),
      margin + 20,
      yPosition + 35
    );
    
    // Created date
    doc.setTextColor(75, 85, 99);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Created', pageWidth - margin - 5, yPosition + 15, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(
      new Date(invoice.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      pageWidth - margin-5,
      yPosition + 30,
      { align: 'right' }
    );

    yPosition += 60;

    // Two Column Layout
    const colWidth = (contentWidth - 20) / 2;
    const leftX = margin;
    const rightX = margin + colWidth + 20;

    // Bill To
    doc.setFillColor(249, 250, 251);
    doc.rect(leftX, yPosition + 20, colWidth, 100, 'F');
    doc.setTextColor(103, 58, 183);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Bill To', leftX + 15, yPosition + 25);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Recipient', leftX + 15, yPosition + 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(invoice.recipient, leftX + 15, yPosition + 70);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Email', leftX + 15, yPosition + 90);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(invoice.email, leftX + 15, yPosition + 110);

    // Payment Details
    doc.setFillColor(249, 250, 251);
    doc.rect(rightX, yPosition + 20, colWidth, 100, 'F');
    doc.setTextColor(103, 58, 183);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Payment Details', rightX + 15, yPosition + 25);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Payment Method', rightX + 15, yPosition + 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(invoice.paymentCollection || 'Crypto', rightX + 15, yPosition + 70);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Due Date', rightX + 15, yPosition + 90);
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(
      new Date(invoice.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      rightX + 15,
      yPosition + 110
    );

    yPosition += 130;

    // Items & Services
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Items & Services', margin, yPosition + 20);

    yPosition += 30;

    // Table using autoTable
    const tableData = invoice.lineItems.map(item => [
      item.description,
      `${invoice.currency} ${item.amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['DESCRIPTION', 'AMOUNT']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [249, 250, 251],
        textColor: [55, 65, 81],
        fontStyle: 'bold',
        fontSize: 12
      },
      bodyStyles: {
        textColor: [0, 0, 0],
        fontSize: 11
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      margin: { left: margin, right: margin },
      styles: {
        cellPadding: 8,
        fontSize: 11,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { cellWidth: 100, halign: 'right' }
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 30;

    // Total Amount
    doc.setFillColor(251, 146, 60);
    doc.rect(margin, yPosition, contentWidth, 60, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.text('Total Amount Due', pageWidth / 2, yPosition + 25, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(
      `${invoice.currency} ${invoice.totalAmount.toFixed(2)}`,
      pageWidth / 2,
      yPosition + 50,
      { align: 'center' }
    );

    yPosition += 80;

    // Payment Link
    if (invoice.paymentLink?.url) {
      doc.setFillColor(220, 252, 231);
      doc.rect(margin, yPosition, contentWidth, 80, 'F');
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(1);
      doc.rect(margin, yPosition, contentWidth, 80, 'S');
      
      doc.setTextColor(21, 128, 61);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Payment Link Available', pageWidth / 2, yPosition + 25, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text(
        'Visit the link below to make your payment:', 
        pageWidth / 2,
        yPosition + 45,
        { align: 'center' }
      );
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const url = invoice.paymentLink.url;
      const shortUrl = url.length > 60 ? url.substring(0, 57) + '...' : url;
      doc.text(shortUrl, pageWidth / 2, yPosition + 65, { align: 'center' });
      
      yPosition += 100;
    }

    // Footer
    yPosition = Math.max(yPosition + 30, doc.internal.pageSize.getHeight() - 60);
    
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(1);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Thank you for your business!', pageWidth / 2, yPosition + 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(
      'If you have any questions about this invoice, please contact us.',
      pageWidth / 2,
      yPosition + 45,
      { align: 'center' }
    );

    // Generate and return PDF
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.id}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}