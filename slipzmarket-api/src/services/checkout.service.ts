import prisma from '../db.js';
import { MailerService } from './mailer.service.js';
import { NotificationService } from './notification.service.js'; // 👈 Cleaned up import

const isCredentialsPackage = (pkg: any) => {
  return pkg?.includesCredentials || pkg?.category === 'Email & Password';
};

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

        // 7. IF THE CART CONTAINS CREDENTIAL-ONLY PACKAGES, ALLOCATE AND LOCK THEM
        const credentialItems = cartItems.filter(i => isCredentialsPackage(i.package));
        let allocatedCredentials: any[] = [];
        if (credentialItems.length > 0) {
          const totalToAllocate = credentialItems.reduce((acc, cur) => acc + (Number(cur.package.leadsCount) * cur.quantity), 0);

          if (totalToAllocate > 0) {
            // Fetch available (unlocked) credentials
            const available = await tx.credentialRecord.findMany({ where: { locked: false }, take: totalToAllocate });
            if (available.length < totalToAllocate) {
              throw new Error('ORDER_ABORTED: Not enough credentials available to fulfill this purchase.');
            }

            const ids = available.map(c => c.id);

            // Mark them locked so they can't be re-sold
            await tx.credentialRecord.updateMany({ where: { id: { in: ids } }, data: { locked: true } });

            // Create UnlockedCredential records linking to this invoice/workspace
            await tx.unlockedCredential.createMany({ data: ids.map(id => ({ workspaceId: workspaceId, credentialId: id, invoiceId: invoice.id })), skipDuplicates: true });

            // Add a List record for the purchaser to see the purchased dataset in their dashboard
            await tx.list.create({ data: { name: `Purchased Credentials ${invoice.id}`, contactCount: ids.length, dataType: 'Email & Password', status: 'Ready to Export', userId } });

            allocatedCredentials = available; // return the full records for post-commit emailing
          }
        }
        // 8. CLEANUP
        await tx.cartItem.deleteMany({ where: { userId } });

        return { 
          invoice, 
          isDuplicate: false, 
          receiptData: { email: targetEmail, name: targetName },
          allocatedCredentials
        };
      });

      // If credentials were allocated, email CSV to buyer (post-transaction to avoid locking issues)
      if (result && result.allocatedCredentials && result.allocatedCredentials.length > 0) {
        try {
          const rows = result.allocatedCredentials.map((r: any) => `${r.email},${r.password}`).join('\n');
          const csv = `email,password\n${rows}`;

          await MailerService.send({
            to: result.receiptData.email,
            templateName: 'CREDENTIALS_DELIVERY',
            context: { name: result.receiptData.name, invoiceId: result.invoice.id, count: result.allocatedCredentials.length },
            attachments: [{ filename: `${result.invoice.id}-credentials.csv`, content: csv, contentType: 'text/csv' }]
          });
        } catch (err: any) {
          console.error('Silent failure: Could not send credentials CSV:', err);
          NotificationService.sendToUser(userId, {
            title: 'Credentials delivery failed',
            message: 'Your purchased credentials were allocated but we could not email them. Please contact support.',
            type: 'ERROR',
            link: '/dashboard/support'
          });
        }
      }

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
          try {
            await MailerService.send({
              to: result.receiptData.email,
              templateName: 'INVOICE_CONFIRMATION', // Ensure this matches your EmailTemplate DB table
              context: {
                name: result.receiptData.name,
                invoiceId: result.invoice.id,
                amount: stripeAmountPaid.toFixed(2),
                credits: totalLeadsBought
              }
            });
          } catch (err: any) {
            console.error('Silent failure: Could not send receipt email:', err);
          }
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