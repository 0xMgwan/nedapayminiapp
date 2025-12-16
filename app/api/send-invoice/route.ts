import { MailtrapClient } from 'mailtrap';
import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

// Setup Mailtrap client
const client = new MailtrapClient({
  token: process.env.MAILTRAP_NEDAPAY_DOMAIN_TOKEN!
});

export async function POST(req: Request) {
  try {
    const { merchantId, recipient,sender, email, paymentCollection, dueDate, currency, lineItems, paymentLink } = await req.json();

    // Validate payment link if provided
    let paymentLinkRecord = null;
    if (paymentLink) {
      // First try to find the payment link in the database
      paymentLinkRecord = await prisma.paymentLink.findUnique({
        where: { url: paymentLink },
      });
      
      // If found in database, validate it's active
      if (paymentLinkRecord && paymentLinkRecord.status !== 'Active') {
        return NextResponse.json({ error: 'Payment link is not active' }, { status: 400 });
      }
      
      // If not found in database, allow external payment links
      // Just validate that it's a valid URL format
      if (!paymentLinkRecord) {
        try {
          new URL(paymentLink);
          console.log('Using external payment link:', paymentLink);
        } catch (error) {
          return NextResponse.json({ error: 'Invalid payment link format' }, { status: 400 });
        }
      }
    }

    // Calculate total amount
    const totalAmount = lineItems.reduce((sum: number, item: any) => sum + parseFloat(item.amount || 0), 0);

    // Create invoice with payment link reference
    const invoice = await prisma.invoice.create({
      data: {
        merchantId,
        recipient,
        sender,
        email,
        paymentCollection,
        dueDate: new Date(dueDate),
        currency,
        totalAmount,
        status: 'draft',
        paymentLinkId: paymentLinkRecord?.id || null,
        lineItems: {
          create: lineItems.map((item: any) => ({
            description: item.description,
            amount: parseFloat(item.amount || 0),
          })),
        },
      },
    });

    // Generate line items HTML
    const htmlItems = lineItems
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">${item.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: right; font-weight: 600;">${currency} ${parseFloat(item.amount || 0).toFixed(2)}</td>
        </tr>
        `
      )
      .join('');

    // Professional HTML email template
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice from ${sender}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.025em;">Invoice</h1>
          <p style="color:#ffffff; margin: 8px 0 0 0; font-size: 16px;">Payment Request</p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
          
          <!-- Greeting -->
          <div style="margin-bottom: 32px;">
            <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">Dear ${recipient},</h2>
            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0;">We hope this email finds you well. Please find your invoice details below.</p>
          </div>

          <!-- Invoice Details -->
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #667eea;">
            <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 20px 0;">Invoice Information</h3>
            <div style="display: grid; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280; font-weight: 500;">Invoice ID:</span>
                <span style="color: #1f2937; font-weight: 600;">#${invoice.id}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280; font-weight: 500;">Merchant:</span>
                <span style="color: #1f2937; font-weight: 600;">${sender}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280; font-weight: 500;">Payment Method:</span>
                <span style="color: #1f2937; font-weight: 600;">${paymentCollection}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280; font-weight: 500;">Due Date:</span>
                <span style="color: #dc2626; font-weight: 600;">${new Date(dueDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                <span style="color: #6b7280; font-weight: 500;">Currency:</span>
                <span style="color: #1f2937; font-weight: 600;">${currency}</span>
              </div>
            </div>
          </div>

          <!-- Line Items -->
          <div style="margin-bottom: 32px;">
            <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 20px 0;">Items & Services</h3>
            <div style="overflow-x: auto; border-radius: 8px; border: 1px solid #e5e7eb;">
              <table style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 16px 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Description</th>
                    <th style="padding: 16px 12px; text-align: right; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${htmlItems}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Total Amount -->
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px; padding: 24px; margin-bottom: 32px; text-align: center;">
            <p style="color: #ffffff; font-size: 16px; margin: 0 0 8px 0; opacity: 0.9;">Total Amount Due</p>
            <p style="color: #ffffff; font-size: 32px; font-weight: 700; margin: 0; letter-spacing: -0.025em;">${currency} ${totalAmount.toFixed(2)}</p>
          </div>

          ${paymentLink ? `
          <!-- Payment Link -->
          <div style="text-align: center; margin-bottom: 32px;">
            <p style="color: #6b7280; font-size: 16px; margin: 0 0 20px 0;">Click the button below to proceed with your payment:</p>
            <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color:rgb(22, 18, 233); text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); transition: all 0.2s;">
              Pay Now
            </a>
            <p style="color: #9ca3af; font-size: 14px; margin: 16px 0 0 0;">
              Payment Link: <span style="color: #6b7280; word-break: break-all;">${paymentLink}</span>
            </p>
          </div>
          ` : ''}

          <!-- Footer Message -->
          <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; text-align: center;">
            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              Thank you for your business! If you have any questions about this invoice, please don't hesitate to contact us.
            </p>
            <p style="color: #9ca3af; font-size: 14px; margin: 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            © ${new Date().getFullYear()} NedaPay. All rights reserved.
          </p>
        </div>

      </div>
    </body>
    </html>
    `;

    // Send email using Mailtrap client
    const senderEmail = {
      name: "Invoice Service",
      email: `${process.env.MAILTRAP_INVOICE_EMAIL}`
    };

    try {
      const emailResult = await client.send({
        from: senderEmail,
        to: [{ email: email }],
        subject: `Invoice #${invoice.id} from ${merchantId} - Due ${new Date(dueDate).toLocaleDateString()}`,
        html: htmlContent,
      });

      console.log('Email sent successfully:', emailResult);

      // Update invoice status to 'sent' and record sentAt timestamp
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });

    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue with invoice creation even if email fails
    }

    return NextResponse.json({ success: true, invoice });

  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}