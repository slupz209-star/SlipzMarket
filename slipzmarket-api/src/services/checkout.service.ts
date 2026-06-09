import prisma from '../db.js';
import { MailerService } from './mailer.service.js';
import { NotificationService } from './notification.service.js'; // 👈 Cleaned up import

export const CheckoutService = {
  async completeOrder(
    userId: string, 
    workspaceId: string, 
    stripeIntentId: string, 
    stripeAmountPaid: number,
    billingDetails: any,
    totalLeadsBought: number
  ) {
    
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
    const targetEmail = billingDetails?.email?.trim() || user?.email;
    const targetName = billingDetails?.firstName?.trim() || user?.firstName || 'User';
    const shouldUpsertBilling = billingDetails && typeof billingDetails === 'object' && billingDetails.email?.trim();

    // 1. FAST IDEMPOTENCY CHECK
    const existingInvoice = await prisma.invoice.findUnique({ 
      where: { id: `INV-${stripeIntentId}` }
    });
    
    if (existingInvoice) {
      return { invoice: existingInvoice, isDuplicate: true };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 2. Fetch cart items to verify price
        const cartItems = await tx.cartItem.findMany({ 
          where: { userId },
          include: { package: true } 
        });
        
        if (cartItems.length === 0) {
          throw new Error('ORDER_ABORTED: Cart is empty.');
        }

        // 3. PRICE INTEGRITY
        const calculatedTotal = cartItems.reduce((acc, item) => acc + (Number(item.package.price) * item.quantity), 0);
        if (Math.abs(calculatedTotal - stripeAmountPaid) > 0.01) { 
          throw new Error(`ORDER_ABORTED: Price mismatch.`);
        }

        // 4. Billing Profile
        if (shouldUpsertBilling) {
          await tx.billingProfile.upsert({
            where: { userId },
            update: billingDetails,
            create: { userId, ...billingDetails }
          });
        }

// 5. ATOMIC INVOICE CREATION WITH BILLING PERSISTENCE
const invoice = await tx.invoice.create({
  data: {
    id: `INV-${stripeIntentId}`,
    description: 'SlipZMarket Data Credits Purchase',
    amount: stripeAmountPaid,
    status: 'COMPLETED',
    workspaceId: workspaceId,
    userId: userId,
    // Add billing details if provided to make your invoices legally compliant
    billingDetails: billingDetails ? JSON.stringify(billingDetails) : null,
    
    // Nested items creation
    items: {
      create: cartItems.map(item => ({
        packageId: item.packageId,
        quantity: item.quantity,
        // Ensure price is cast to Decimal/Number as per your Prisma model
        priceAtPurchase: Number(item.package.price), 
      }))
    }
  },
  // Include items in the response so you can pass them to the PDF Generator immediately
  include: {
    items: {
      include: {
        package: true
      }
    }
  }
});

        // 6. UPDATE CREDITS (The Wallet Minting)
        // This is now purely a financial transaction. No lead allocation happens here.
        await tx.user.update({
          where: { id: userId },
          data: { exportCreditsTotal: { increment: totalLeadsBought } }
        });

        // 7. CLEANUP
        await tx.cartItem.deleteMany({ where: { userId } });

        return { 
          invoice, 
          isDuplicate: false, 
          receiptData: { email: targetEmail, name: targetName } 
        };
      });

      // ==========================================
      // 🟢 POST-TRANSACTION SUCCESS ACTIONS
      // ==========================================
      if (result.invoice) {
        // 1. Send In-App Notification
        NotificationService.sendToUser(userId, {
          title: 'Credits Purchased! 🎉',
          message: `Successfully added ${totalLeadsBought} credits to your wallet.`,
          type: 'SUCCESS',
          link: '/dashboard/wallet'
        });

        // 2. Dispatch Email Receipt (Non-blocking)
        if (result.receiptData.email) {
          MailerService.send({
            to: result.receiptData.email,
            templateName: 'INVOICE_CONFIRMATION', // Ensure this matches your EmailTemplate DB table
            context: {
              name: result.receiptData.name,
              invoiceId: result.invoice.id,
              amount: stripeAmountPaid.toFixed(2),
              credits: totalLeadsBought
            }
          }).catch(err => console.error('Silent failure: Could not send receipt email:', err));
        }
      }

      return result;

    } catch (error: any) {
      // ==========================================
      // 🔴 TRANSACTION FAILURE ACTION
      // ==========================================
      if (!error.message.includes('Cart is empty')) {
        NotificationService.sendToUser(userId, { 
          title: 'Checkout Failed ❌', 
          message: error.message.replace('ORDER_ABORTED: ', ''), 
          type: 'ERROR' 
        });
      }
      throw error;
    }
  }
};