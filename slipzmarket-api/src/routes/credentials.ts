import { Router, Request, Response } from 'express';
import { Parser } from 'json2csv';
import prisma from '../db';
import { CoreService } from '../services/core.services';
import { requireAuth } from './middleware/auth.middleware';

const router = Router();

// Export purchased credentials as CSV
router.get('/:invoiceId/csv', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const { invoiceId } = req.params;
  const workspaceId = req.user.workspaceId;
  const userId = req.user.userId;

  // Verify ownership
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, workspaceId, userId, status: 'COMPLETED' } });
  if (!invoice) return res.status(403).json({ error: 'Unauthorized. You do not own this dataset.' });

  const unlockedRecords = await prisma.unlockedCredential.findMany({ where: { invoiceId }, include: { credential: true } });
  if (unlockedRecords.length === 0) return res.status(404).json({ error: 'No credentials found for this dataset.' });

  const rows = unlockedRecords.map(r => ({
    Email: r.credential.email,
    Username: r.credential.username || '',
    Password: r.credential.password,
    Website: r.credential.website || '',
    Notes: r.credential.notes || ''
  }));

  const parser = new Parser();
  const csv = parser.parse(rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="SlipZMarket_Credentials_${invoiceId}.csv"`);
  return res.status(200).send(csv);
}));

// Fetch purchased credentials as JSON for workspace view (sensitive: gated by invoice ownership)
router.get('/:invoiceId/json', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const { invoiceId } = req.params;
  const workspaceId = req.user.workspaceId;
  const userId = req.user.userId;

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, workspaceId, userId, status: 'COMPLETED' } });
  if (!invoice) return CoreService.error(res, 403, 'Unauthorized access to dataset');

  const unlockedRecords = await prisma.unlockedCredential.findMany({ where: { invoiceId }, include: { credential: true } });

  const creds = unlockedRecords.map(r => ({
    id: r.credential.id,
    email: r.credential.email,
    username: r.credential.username || '',
    password: r.credential.password,
    website: r.credential.website || '',
    notes: r.credential.notes || ''
  }));

  return CoreService.success(res, 200, 'Credentials loaded', { credentials: creds });
}));

export default router;

// -------------------------
// SEARCH CREDENTIALS (for UI discovery)
// -------------------------
router.post('/search', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const { email, website, username } = req.body;
  const { userId, workspaceId } = req.user;

  // 1. Exclude credentials already unlocked by this workspace
  const already = await prisma.unlockedCredential.findMany({ where: { workspaceId }, select: { credentialId: true } });
  const alreadyIds = already.map(a => a.credentialId);

  const where: any = {};
  if (email?.trim()) where.email = { contains: email.trim(), mode: 'insensitive' };
  if (website?.trim()) where.website = { contains: website.trim(), mode: 'insensitive' };
  if (username?.trim()) where.username = { contains: username.trim(), mode: 'insensitive' };
  if (alreadyIds.length > 0) where.id = { notIn: alreadyIds };
  // Exclude credentials that have already been sold/locked
  where.locked = false;

  const results = await prisma.credentialRecord.findMany({ where, take: 100 });

  return CoreService.success(res, 200, 'Credentials search results', { data: results });
}));

// -------------------------
// SAVE CREDENTIALS TO LIST (consume credits + allocate)
// -------------------------
router.post('/save-to-list', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const { credentialIds } = req.body;
  const { userId, workspaceId } = req.user;

  if (!credentialIds || credentialIds.length === 0) return CoreService.error(res, 400, 'No credentials selected');

  const result = await prisma.$transaction(async (tx) => {
    // 1. Check credits
    const user = await tx.user.findUnique({ where: { id: userId }, select: { exportCreditsTotal: true, exportCreditsUsed: true } });
    const balance = (user?.exportCreditsTotal || 0) - (user?.exportCreditsUsed || 0);
    if (balance < credentialIds.length) throw new Error('INSUFFICIENT_CREDITS');

    // 2. Filter already unlocked
    const existing = await tx.unlockedCredential.findMany({ where: { workspaceId, credentialId: { in: credentialIds } }, select: { credentialId: true } });
    const already = existing.map(e => e.credentialId);
    const toUnlock = credentialIds.filter((id: string) => !already.includes(id));

    if (toUnlock.length === 0) return { count: 0 };

    // 3. Create system invoice
    const invoice = await tx.invoice.create({
      data: {
        id: `INV-SYS-${Date.now()}`,
        description: 'Credential allocation',
        amount: 0,
        status: 'COMPLETED',
        userId,
        workspaceId
      }
    });

    // 4. Ensure none of the requested credentials are locked and allocate
    const available = await tx.credentialRecord.findMany({ where: { id: { in: toUnlock }, locked: false }, select: { id: true } });
    const availableIds = available.map(a => a.id);
    if (availableIds.length === 0) return { count: 0 };
    await tx.unlockedCredential.createMany({ data: availableIds.map((credentialId: string) => ({ workspaceId, credentialId, invoiceId: invoice.id })), skipDuplicates: true });

    // 5. Deduct credits
    await tx.user.update({ where: { id: userId }, data: { exportCreditsUsed: { increment: toUnlock.length } } });

    return { count: toUnlock.length };
  });

  return CoreService.success(res, 200, 'Credentials saved to list', { unlockedCount: result.count });
}));
