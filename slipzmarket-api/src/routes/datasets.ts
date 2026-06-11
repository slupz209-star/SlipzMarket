import { Router, Response } from 'express';
import { requireAuth } from './middleware/auth.middleware';
import { CoreService } from '../services/core.services';
import prisma from '../db';
import NotificationService from '../services/notification.service.js';
import { Parser } from 'json2csv';

const router = Router();

// 1. GET PURCHASED DATASETS (For the UI Table)
router.get('/my-datasets', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const workspaceId = req.user.workspaceId;
  const userId = req.user.userId;
  const includeDeleted = req.query.includeDeleted === 'true';

  const statuses = includeDeleted ? ['COMPLETED', 'DELETED'] : ['COMPLETED'];

  // Fetch all invoices owned by this user that actually have unlocked leads attached
  const invoices = await prisma.invoice.findMany({
    where: {
      workspaceId,
      userId,
      status: { in: statuses }
    },
    include: {
      _count: {
        select: { unlockedLeads: true, unlockedCredentials: true }
      }
    },
    orderBy: { date: 'desc' }
  });

  const mappedDatasets = invoices
    .filter(inv => ((inv._count?.unlockedLeads || 0) > 0) || ((inv._count?.unlockedCredentials || 0) > 0))
    .map(inv => ({
      invoiceId: inv.id,
      date: inv.date,
      leadsCount: (inv._count?.unlockedLeads || 0) + (inv._count?.unlockedCredentials || 0),
      description: inv.description || 'Custom Data Export',
      filters: (inv as any).queryCriteria || {},
      status: inv.status
    }));

  const activeDatasets = mappedDatasets.filter(ds => ds.status === 'COMPLETED');
  const trashedDatasets = mappedDatasets.filter(ds => ds.status === 'DELETED');

  if (includeDeleted) {
    return CoreService.success(res, 200, 'Datasets fetched', { activeDatasets, trashedDatasets });
  }

  return CoreService.success(res, 200, 'Datasets fetched', { datasets: activeDatasets });
}));

// 2. DOWNLOAD CSV ENDPOINT
router.get('/download/:invoiceId', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const { invoiceId } = req.params;
  const workspaceId = req.user.workspaceId;
  const userId = req.user.userId;

  // A. SECURITY CHECK: Verify this user actually owns this invoice
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      workspaceId,
      userId,
      status: 'COMPLETED'
    }
  });

  if (!invoice) {
    return res.status(403).json({ error: 'Unauthorized. You do not own this dataset.' });
  }

  // B. FETCH THE ACTUAL LEADS
  // Try leads first
  let unlockedRecords = await prisma.unlockedLead.findMany({ where: { invoiceId: invoiceId }, include: { lead: true } });

  // If no master leads, fall back to credentials
  let isCredentialExport = false;
  let credentialRecords: any[] = [];
  if (!unlockedRecords || unlockedRecords.length === 0) {
    const unlockedCreds = await prisma.unlockedCredential.findMany({ where: { invoiceId }, include: { credential: true } });
    if (!unlockedCreds || unlockedCreds.length === 0) {
      return res.status(404).json({ error: 'No data found for this dataset.' });
    }
    isCredentialExport = true;
    credentialRecords = unlockedCreds.map(r => r.credential);
  }

  // C. FLATTEN THE DATA FOR THE CSV
  let leadsToExport;
  if (!isCredentialExport) {
    leadsToExport = unlockedRecords.map(record => ({
      ContactName: record.lead.contactName || `${record.lead.firstName || ''} ${record.lead.lastName || ''}`.trim(),
      FirstName: record.lead.firstName || '',
      LastName: record.lead.lastName || '',
      Speciality: record.lead.speciality || '',
      SpecialityID: record.lead.specialityID || '',
      Description: record.lead.description || '',
      Title: record.lead.title || record.lead.jobTitle || '',
      CompanyName: record.lead.companyName || '',
      Email: record.lead.email || '',
      EmailAddress: record.lead.emailAddress || '',
      Website: record.lead.website || '',
      Phone: record.lead.phone || 'N/A',
      PhoneNumber: record.lead.phoneNumber || '',
      FaxNumber: record.lead.faxNumber || '',
      Address: record.lead.address || '',
      City: record.lead.city || '',
      State: record.lead.state || '',
      Country: record.lead.country || '',
      ZipCode: record.lead.zipCode || ''
    }));
  } else {
    leadsToExport = credentialRecords.map(c => ({
      Email: c.email,
      Username: c.username || '',
      Password: c.password,
      Website: c.website || '',
      Notes: c.notes || ''
    }));
  }

  // D. GENERATE CSV
  const json2csvParser = new Parser();
  const csvData = json2csvParser.parse(leadsToExport);

  // E. STREAM TO BROWSER AS A FILE DOWNLOAD
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="SlipZMarket_Export_${invoiceId}.csv"`);
  
  return res.status(200).send(csvData);
}));

// 3. FETCH JSON DATASET FOR WORKSPACE VIEW
router.get('/:invoiceId/json', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const { invoiceId } = req.params;
  const workspaceId = req.user.workspaceId;
  const userId = req.user.userId;

  // 1. Verify Ownership
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, workspaceId, userId, status: 'COMPLETED' }
  });

  if (!invoice) return CoreService.error(res, 403, 'Unauthorized access to dataset');

  // 2. Fetch the raw leads
  // 2. Fetch the raw leads OR credentials
  let unlockedRecords = await prisma.unlockedLead.findMany({ where: { invoiceId }, include: { lead: true } });
  let leads: any[] = [];
  if (unlockedRecords && unlockedRecords.length > 0) {
    leads = unlockedRecords.map(record => ({
      id: record.lead.id,
      contactName: record.lead.contactName || `${record.lead.firstName || ''} ${record.lead.lastName || ''}`.trim(),
      firstName: record.lead.firstName || '',
      lastName: record.lead.lastName || '',
      speciality: record.lead.speciality || '',
      specialityID: record.lead.specialityID || '',
      description: record.lead.description || '',
      title: record.lead.title || record.lead.jobTitle || '',
      companyName: record.lead.companyName || '',
      email: record.lead.email || '',
      emailAddress: record.lead.emailAddress || '',
      website: record.lead.website || '',
      phone: record.lead.phone || 'N/A',
      phoneNumber: record.lead.phoneNumber || '',
      faxNumber: record.lead.faxNumber || '',
      address: record.lead.address || '',
      city: record.lead.city || '',
      state: record.lead.state || '',
      country: record.lead.country || '',
      zipCode: record.lead.zipCode || ''
    }));
  } else {
    // Fall back to unlocked credentials list
    const unlockedCreds = await prisma.unlockedCredential.findMany({ where: { invoiceId }, include: { credential: true } });
    leads = unlockedCreds.map(r => ({
      id: r.credential.id,
      contactName: r.credential.email,
      firstName: '',
      lastName: '',
      speciality: '',
      specialityID: '',
      description: 'Purchased Credentials',
      title: '',
      companyName: '',
      email: r.credential.email,
      password: r.credential.password,
      username: r.credential.username || '',
      website: r.credential.website || '',
      phone: 'N/A',
      phoneNumber: '',
      faxNumber: '',
      address: '',
      city: '',
      state: '',
      country: '',
      zipCode: ''
    }));
  }

  return CoreService.success(res, 200, 'Data loaded', { leads });
}));

// --- SOFT DELETE ENTIRE DATASET ---
router.delete('/:invoiceId', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const { invoiceId } = req.params;
  const workspaceId = req.user.workspaceId;
  const userId = req.user.userId;

  // Verify ownership
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, workspaceId, userId, status: 'COMPLETED' }
  });

  if (!invoice) return CoreService.error(res, 403, 'Unauthorized access');

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'DELETED' }
  });

  await NotificationService.sendToUser(req.user.userId, {
    title: 'Dataset Trashed',
    message: `The dataset associated with Invoice ${invoiceId} has been moved to trash. You can restore it later.`,
    type: 'INFO',
    link: '/datasets'
  });

  return CoreService.success(res, 200, 'Dataset moved to trash successfully');
}));

// --- RESTORE TRASHED DATASET ---
router.post('/:invoiceId/restore', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const { invoiceId } = req.params;
  const workspaceId = req.user.workspaceId;
  const userId = req.user.userId;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, workspaceId, userId, status: 'DELETED' }
  });

  if (!invoice) return CoreService.error(res, 403, 'Unauthorized access');

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'COMPLETED' }
  });

  await NotificationService.sendToUser(req.user.userId, {
    title: 'Dataset Restored',
    message: `The dataset associated with Invoice ${invoiceId} has been restored to your active library.`,
    type: 'SUCCESS',
    link: `/datasets/${invoiceId}`
  });

  return CoreService.success(res, 200, 'Dataset restored successfully');
}));

// --- REMOVE SPECIFIC LEADS FROM A DATASET ---
router.post('/:invoiceId/remove-leads', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const { invoiceId } = req.params;
  const { leadIds } = req.body;
  const workspaceId = req.user.workspaceId;
  const userId = req.user.userId;

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return CoreService.error(res, 400, 'No leads provided for deletion');
  }

  // Verify ownership before modifying dataset contents
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, workspaceId, userId }
  });

  if (!invoice) return CoreService.error(res, 403, 'Unauthorized access');

  await prisma.unlockedLead.deleteMany({
    where: {
      invoiceId,
      workspaceId,
      leadId: { in: leadIds }
    }
  });

  await NotificationService.sendToUser(req.user.userId, {
    title: 'Dataset Updated',
    message: `${leadIds.length} lead(s) were removed from dataset ${invoiceId}.`,
    type: 'INFO',
    link: `/datasets/${invoiceId}`
  });

  return CoreService.success(res, 200, 'Selected leads removed');
}));


// =========================================================================
// 🚀 UPDATED: PROSPECT SEARCH ENGINE (PACKAGE-AWARE & MASTER DB SEARCH)
// =========================================================================
router.post('/search', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const { jobTitle, industry, location } = req.body;
  const { userId, workspaceId } = req.user;

  // 1. FETCH USER CREDITS (from User) AND INVOICES (from Workspace)
  const [userRecord, workspaceData] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { exportCreditsTotal: true, exportCreditsUsed: true }
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        invoices: { 
          where: { status: 'COMPLETED' },
          include: { items: { include: { package: true } } }
        }
      }
    })
  ]);

  // 2. CREDIT GATEKEEPER
  const remaining = (userRecord?.exportCreditsTotal || 0) - (userRecord?.exportCreditsUsed || 0);
  if (remaining <= 0) {
    return CoreService.error(res, 403, 'Insufficient prospect credits.');
  }

  // 3. DETERMINE PERMISSIONS FROM PACKAGES (via Workspace Invoices)
  const workspaceInvoices: any[] = workspaceData?.invoices || [];

  const canViewEmail = workspaceInvoices.some(inv => 
    inv.items?.some((i: any) => i.package?.includesEmail)
  ) || false;

  const canViewPhone = workspaceInvoices.some(inv => 
    inv.items?.some((i: any) => i.package?.includesPhone)
  ) || false;

  // 4. BUILD MASTER DB SEARCH FILTERS
  const where: any = {};
  if (jobTitle?.trim()) {
    const searchTerm = jobTitle.trim();
    where.OR = [
      { jobTitle: { contains: searchTerm, mode: 'insensitive' } },
      { title: { contains: searchTerm, mode: 'insensitive' } },
      { companyName: { contains: searchTerm, mode: 'insensitive' } },
      { contactName: { contains: searchTerm, mode: 'insensitive' } },
      { firstName: { contains: searchTerm, mode: 'insensitive' } },
      { lastName: { contains: searchTerm, mode: 'insensitive' } },
      { speciality: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }
  if (industry && industry !== 'All') where.industry = { contains: industry, mode: 'insensitive' };
  if (location?.trim()) where.country = { contains: location.trim(), mode: 'insensitive' };

  // 5. EXCLUDE ALREADY OWNED LEADS
  const alreadyUnlocked = await prisma.unlockedLead.findMany({
    where: { workspaceId },
    select: { leadId: true }
  });
  const unlockedIds = alreadyUnlocked.map(ul => ul.leadId);
  if (unlockedIds.length > 0) where.id = { notIn: unlockedIds };

  // 6. EXECUTE SECURE QUERY
  const selectFields: any = {
    id: true,
    contactName: true,
    firstName: true,
    lastName: true,
    speciality: true,
    specialityID: true,
    description: true,
    title: true,
    jobTitle: true,
    companyName: true,
    industry: true,
    country: true,
    website: true,
    address: true,
    city: true,
    state: true,
    zipCode: true,
    faxNumber: true,
    phoneNumber: true,
  };
  if (canViewEmail) {
    selectFields.email = true;
    selectFields.emailAddress = true;
  }
  if (canViewPhone) {
    selectFields.phone = true;
  }

  const prospects = await prisma.masterLead.findMany({
    where: where,
    take: 100,
    select: selectFields
  });

  return CoreService.success(res, 200, 'Prospects found', { 
    data: prospects,
    permissions: { canViewEmail, canViewPhone }
  });
}));


// 7. SAVE TO LIST (CONSUMES CREDITS & ALLOCATES LEADS)
router.post('/save-to-list', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const { leadIds, listName } = req.body;
  const { userId, workspaceId } = req.user;

  if (!leadIds || leadIds.length === 0) {
    return CoreService.error(res, 400, 'No leads selected');
  }

  // A. ATOMIC TRANSACTION: Check, Deduct, and Allocate
  const result = await prisma.$transaction(async (tx) => {
    // 1. Get current credit status
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { exportCreditsTotal: true, exportCreditsUsed: true }
    });

    const balance = (user?.exportCreditsTotal || 0) - (user?.exportCreditsUsed || 0);
    if (balance < leadIds.length) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    // 2. Prevent double-unlocking (Filter out leads already owned by this workspace)
    const existing = await tx.unlockedLead.findMany({
      where: { workspaceId, leadId: { in: leadIds } },
      select: { leadId: true }
    });
    const alreadyOwnedIds = existing.map(e => e.leadId);
    const newLeads = leadIds.filter((id: string) => !alreadyOwnedIds.includes(id));

    if (newLeads.length === 0) return { count: 0 };

    // 3. Allocate Leads (Assign to workspace)
    // We use a dummy invoiceId 'SYSTEM-SAVED' or create an auto-invoice if preferred
    await tx.unlockedLead.createMany({
      data: newLeads.map((leadId: string) => ({
        workspaceId,
        leadId,
        invoiceId: 'LIST-AUTO-SAVE' // You can link this to a generated List ID instead
      }))
    });

    // 4. Deduct Credits
    await tx.user.update({
      where: { id: userId },
      data: { exportCreditsUsed: { increment: newLeads.length } }
    });

    return { count: newLeads.length };
  });

  return CoreService.success(res, 200, 'Leads saved to list successfully', { 
    unlockedCount: result.count 
  });
}));
export default router;