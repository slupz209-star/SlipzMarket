import prisma from '../db.js';
import { NotificationService } from './notification.service.js';

export const DepositService = {
  async finalizeDeposit(
    userId: string, 
    workspaceId: string, 
    stripeIntentId: string, 
    amountAdded: number
  ) {
    
    // 👉 NEW: Fetch global settings to get the correct dynamic currency symbol
    const settings = await prisma.globalSettings.findUnique({ where: { id: 'singleton' } });
    const currencySymbol = settings?.currency?.includes('£') ? '£' : '$';

    // 1. FAST IDEMPOTENCY CHECK (Outside transaction to save DB locks)
    const existingInvoice = await prisma.invoice.findUnique({ 
      where: { id: `DEP-${stripeIntentId}` }
    });
    
    if (existingInvoice) {
      console.log(`[DEPOSIT] Deposit DEP-${stripeIntentId} already exists. Skipping.`);
      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      return { invoice: existingInvoice, isDuplicate: true, newBalance: workspace?.balance };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {

        // 2. ATOMIC INVOICE/RECEIPT CREATION
        let invoice;
        try {
          invoice = await tx.invoice.create({
            data: {
              id: `DEP-${stripeIntentId}`,
              description: 'Workspace Balance Deposit',
              amount: amountAdded,
              status: 'COMPLETED',
              workspace: { connect: { id: workspaceId } },
              user: { connect: { id: userId } },
            }
          });
        } catch (error: any) {
          // ULTIMATE RACE CONDITION GUARD
          if (error.code === 'P2002') {
            console.warn(`[DEPOSIT] Race condition mitigated for ${stripeIntentId}.`);
            const duplicate = await tx.invoice.findUnique({ where: { id: `DEP-${stripeIntentId}` } });
            const workspace = await tx.workspace.findUnique({ where: { id: workspaceId } });
            return { invoice: duplicate, isDuplicate: true, newBalance: workspace?.balance };
          }
          throw error;
        }

        // 3. BUSINESS LOGIC: Value Delivery (Increment Workspace Balance)
        const updatedWorkspace = await tx.workspace.update({
          where: { id: workspaceId },
          data: { balance: { increment: amountAdded } }
        });

        // 4. Audit Logging
        await tx.activityLog.create({
          data: {
            action: 'FUNDS_DEPOSITED',
            userId,
            metadata: { 
              invoiceId: invoice.id, 
              stripeIntentId,
              amountAdded: amountAdded,
              newBalance: updatedWorkspace.balance,
              source: 'FRONTEND_FINALIZE'
            }
          }
        });

        return { 
          invoice, 
          isDuplicate: false, 
          newBalance: updatedWorkspace.balance 
        };
      });

      // ==========================================
      // 🟢 POST-TRANSACTION SUCCESS ACTION
      // ==========================================
      if (!result.isDuplicate && result.invoice) {
        NotificationService.sendToUser(userId, {
          title: 'Funds Deposited 💰',
          // 👉 NEW: Dynamically insert the correct currency symbol here
          message: `Successfully added ${currencySymbol}${amountAdded.toFixed(2)} to your workspace balance.`,
          type: 'SUCCESS',
          link: '/dashboard/billing'
        });
      }

      return result;

    } catch (error: any) {
      // ==========================================
      // 🔴 TRANSACTION FAILURE ACTION
      // ==========================================
      console.error('[DEPOSIT_SERVICE_ERROR]:', error);
      
      NotificationService.sendToUser(userId, {
        title: 'Deposit Failed ❌',
        message: 'We encountered an issue adding funds to your account. Please contact support if you were charged.',
        type: 'ERROR',
        link: '/dashboard/billing'
      });

      // Rethrow to alert the calling controller
      throw error;
    }
  }
};