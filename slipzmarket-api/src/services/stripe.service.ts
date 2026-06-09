import Stripe from 'stripe';
import prisma from '../db.js'; 

export const getStripeInstance = async () => {
  const settings = await prisma.globalSettings.findUnique({ where: { id: 'singleton' } });
  
  if (!settings || !settings.secretKey) {
    throw new Error('Stripe Secret Key is missing from Global Settings.');
  }

  // 🚨 THE SNITCH LOG: Prints the prefix of the key being used right now 🚨
  console.log('🔑 KEY PULLED FROM DB:', settings.secretKey.substring(0, 12) + '...');

  const stripe = new Stripe(settings.secretKey, {
    apiVersion: '2026-05-27.dahlia' as any,
  });

  return { stripe, settings };
};