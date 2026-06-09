import { Router } from 'express';
import { DepositService } from '../services/deposit.service';
import { requireAuth } from './middleware/auth.middleware'; 
import { getStripeInstance } from '../services/stripe.service'; // 👈 Import your dynamic factory

const router = Router();

// ==========================================
// 1. CREATE STRIPE INTENT (Dynamic Keys)
// ==========================================
router.post('/create-intent', requireAuth, async (req: any, res) => {
  try {
    const { amount } = req.body; 
    
    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Minimum deposit is £10' });
    }

    // 👉 1. Fetch dynamic Stripe instance and settings from your DB
    const { stripe, settings } = await getStripeInstance();

    // Stripe expects amounts in pence (multiply by 100)
    const amountInPence = Math.round(Number(amount) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPence,
      currency: settings.currency === 'GBP (£)' ? 'gbp' : 'usd', // Dynamic currency support
      payment_method_types: ['card'],
      metadata: {
        userId: req.user.userId || req.user.id, // Fallback to handle both auth setups
        workspaceId: req.user.workspaceId,
        type: 'WORKSPACE_DEPOSIT'
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("Stripe Intent Error:", error);
    res.status(500).json({ error: error.message || 'Stripe initialization failed' });
  }
});

// ==========================================
// 2. FINALIZE DEPOSIT (Strict Verification)
// ==========================================
router.post('/finalize-deposit', requireAuth, async (req: any, res) => {
  try {
    const { amount, paymentIntentId } = req.body;
    
    // 👉 1. Fetch dynamic Stripe instance
    const { stripe } = await getStripeInstance();

    // 👉 2. THE SECURITY WALL: Ask Stripe if this payment is real
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Check if payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment has not been confirmed by Stripe.' });
    }

    // Check ownership
    const authUserId = req.user.userId || req.user.id;
    if (paymentIntent.metadata.userId !== authUserId) {
      return res.status(403).json({ error: 'Unauthorized: Payment intent ownership mismatch.' });
    }

    // 👉 3. Prevent frontend manipulation of the amount 
    const verifiedAmount = Number(paymentIntent.amount) / 100;

    // 👉 4. Fulfill the deposit safely
    const result = await DepositService.finalizeDeposit(
      authUserId,
      req.user.workspaceId,
      paymentIntent.id,
      verifiedAmount 
    );

    res.json({ 
      success: true, 
      newBalance: result.newBalance,
      isDuplicate: result.isDuplicate
    });
    
  } catch (error: any) {
    console.error("Deposit Finalization Error:", error);
    res.status(500).json({ error: 'Failed to finalize deposit' });
  }
});

export default router;