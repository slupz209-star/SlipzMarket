// src/routes/packages.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import fs from 'fs';
import os from 'os';
import readline from 'readline';
import { z } from 'zod';
import { CoreService } from '../services/core.services';
import prisma from '../db';
import { requireAuth, requireAdmin } from './middleware/auth.middleware';

const router = Router();

// ==========================================
// MULTER CONFIGURATIONS
// ==========================================
// 1. Memory storage for small payloads (Package Metadata Import)
const uploadMemory = multer({ storage: multer.memoryStorage() });

// 2. Disk storage for massive payloads (50k+ Leads/Credentials) to prevent RAM crashes
const uploadDisk = multer({ dest: os.tmpdir() });

// ==========================================
// VALIDATION SCHEMAS
// ==========================================
const packageSchema = z.object({
  id: z.string().trim().min(3, 'Package ID is required'),
  brand: z.string().trim().min(2, 'Brand name is required'),
  category: z.string().trim().min(2, 'Category is required'),
  
  // Use preprocess to force strings into numbers if they come from CSVs
  leadsCount: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().int().positive('Leads count must be a positive integer')
  ),
  
  price: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive('Price must be positive')
  ),
  
  deliverability: z.string().trim().min(2, 'Deliverability string is required'),
});

// ==========================================
// PUBLIC ROUTES (All Users)
// ==========================================

// GET ALL PACKAGES
router.get('/', CoreService.catchAsync(async (_req: Request, res: Response) => {
  const packages = await prisma.package.findMany({
    orderBy: { leadsCount: 'asc' }
  });

  const formattedPackages = packages.map(pkg => ({
    id: pkg.id,
    brand: pkg.brand,
    category: pkg.category,
    leadsCount: pkg.leadsCount,
    price: Number(pkg.price),
    unitPrice: Number(pkg.price) / pkg.leadsCount,
    deliverability: pkg.deliverability,
    lastUpdated: new Date(pkg.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    type: 'CSV/Excel'
  }));

  return CoreService.success(res, 200, 'Packages retrieved successfully', { packages: formattedPackages });
}));

// GET SINGLE PACKAGE BY ID
router.get('/:id', CoreService.catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string; 
  const pkg = await prisma.package.findUnique({ where: { id } });
  
  if (!pkg) return CoreService.error(res, 404, 'Package not found');
  return CoreService.success(res, 200, 'Package retrieved', { package: pkg });
}));

// ==========================================
// ADMIN ONLY ROUTES
// ==========================================

// CREATE SINGLE PACKAGE
router.post('/', requireAuth, requireAdmin, CoreService.catchAsync(async (req: Request, res: Response) => {
  const validation = packageSchema.safeParse(req.body);
  if (!validation.success) {
    return CoreService.error(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
  }

  const existing = await prisma.package.findUnique({ where: { id: validation.data.id } });
  if (existing) return CoreService.error(res, 400, 'A package with this ID already exists.');

  const newPackage = await prisma.package.create({ 
    data: {
      ...validation.data,
      leadsCount: Number(validation.data.leadsCount || 0),
      price: Number(validation.data.price || 0)
    } 
  });
  return CoreService.success(res, 201, 'Package created successfully', { package: newPackage });
}));

// UPDATE SINGLE PACKAGE
router.put('/:id', requireAuth, requireAdmin, CoreService.catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const validation = packageSchema.partial().safeParse(req.body); 
  if (!validation.success) {
    return CoreService.error(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
  }

  const existing = await prisma.package.findUnique({ where: { id } });
  if (!existing) return CoreService.error(res, 404, 'Package not found');

  const updatedPackage = await prisma.package.update({
    where: { id },
    data: validation.data
  });

  return CoreService.success(res, 200, 'Package updated successfully', { package: updatedPackage });
}));

// DELETE SINGLE PACKAGE
router.delete('/:id', requireAuth, requireAdmin, CoreService.catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.package.findUnique({ where: { id } });
  if (!existing) return CoreService.error(res, 404, 'Package not found');

  await prisma.package.delete({ where: { id } });
  return CoreService.success(res, 200, 'Package deleted successfully');
}));

// ==========================================
// CSV BULK IMPORT METADATA (ADMIN ONLY)
// ==========================================
router.post('/import', requireAuth, requireAdmin, uploadMemory.single('file'), CoreService.catchAsync(async (req: Request | any, res: Response) => {
  if (!req.file) return CoreService.error(res, 400, 'No file uploaded.');

  const results: any[] = [];
  const errors: string[] = [];

  const stream = Readable.from(req.file.buffer.toString());

  stream
    .pipe(csvParser())
    .on('data', (data) => {
      const row = {
        id: data["ID"]?.trim(),
        brand: data["Brand"]?.trim(),
        category: data["Category"]?.trim(),
        leadsCount: parseInt(data["Contacts"], 10),
        price: parseFloat(data["Price"]),
        deliverability: data["Deliverability"]?.trim()
      };

      if (row.id && !isNaN(row.leadsCount) && !isNaN(row.price)) {
        results.push(row);
      } else {
        errors.push(`Skipping invalid row: ${JSON.stringify(data)}`);
      }
    })
    .on('end', async () => {
      console.log('📦 CSV Metadata Processing Finished. Total rows parsed:', results.length);
      if (results.length === 0) return CoreService.error(res, 400, 'CSV file is empty or formatted incorrectly.');

      try {
        const insertData = await prisma.package.createMany({
          data: results,
          skipDuplicates: true, 
        });

        return CoreService.success(res, 201, 'CSV Import Complete', {
          rowsProcessed: results.length,
          rowsInserted: insertData.count,
          errors: errors.length > 0 ? errors : null
        });
      } catch (dbError: any) {
        console.error("❌ CRITICAL Bulk Insert Error:", dbError);
        return CoreService.error(res, 500, `Database error: ${dbError.message || 'Unknown database error'}`);
      }
    });
}));

// ==========================================
// HELPER FUNCTIONS FOR BULK LEAD UPLOADS
// ==========================================
const cleanupFile = (filePath: string | undefined) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`🧹 Cleaned up temporary file: ${filePath}`);
    } catch (err) {
      console.error(`⚠️ Failed to delete temporary file ${filePath}:`, err);
    }
  }
};

const normalizeCsvRow = (data: any, defaultCategory: string) => {
  // 1. Initial extraction of names
  let firstName = data['firstName']?.trim() || data['First Name']?.trim() || data['first_name']?.trim() || '';
  let lastName = data['lastName']?.trim() || data['Last Name']?.trim() || data['last_name']?.trim() || '';
  let contactName = data['contactName']?.trim() || data['Contact Name']?.trim() || data['ContactName']?.trim() || '';

  // 2. 👉 SPLIT NAME LOGIC: If we have a contactName but no explicit first/last name, split it
  if (contactName && (!firstName && !lastName)) {
    const nameParts = contactName.split(' ');
    firstName = nameParts[0] || ''; // First word
    lastName = nameParts.slice(1).join(' ') || ''; // Everything else
  } else if (!contactName && (firstName || lastName)) {
    // If we only have first/last name, combine them for the contactName field
    contactName = `${firstName} ${lastName}`.trim();
  }

  // 3. Email Extraction
  const email = data['email']?.trim() || data['Email']?.trim() || '';
  const emailAddress = data['emailAddress']?.trim() || data['Email Address']?.trim() || data['EmailAddress']?.trim() || email;
  
  // 4. 👉 UNIFIED PHONE LOGIC: Grab the first available phone number and apply to BOTH fields
  const unifiedPhone = data['phoneNumber']?.trim() || data['PhoneNumber']?.trim() || data['Phone Number']?.trim() || data['phone']?.trim() || data['Phone']?.trim() || null;
  
  const title = data['title']?.trim() || data['Title']?.trim() || data['jobTitle']?.trim() || '';

  return {
    contactName: contactName || null,
    firstName: firstName || null,
    lastName: lastName || null,
    speciality: data['speciality']?.trim() || data['Speciality']?.trim() || null,
    specialityID: data['specialityID']?.trim() || data['Speciality ID']?.trim() || data['specialityId']?.trim() || null,
    description: data['description']?.trim() || data['Description']?.trim() || null,
    title: title || null,
    companyName: data['companyName']?.trim() || data['Company']?.trim() || data['Company Name']?.trim() || 'Unknown',
    email: emailAddress || '',
    emailAddress: emailAddress || null,
    website: data['website']?.trim() || data['Website']?.trim() || null,
    
    // Assigning the unified phone string to both database fields
    phone: unifiedPhone,
    phoneNumber: unifiedPhone,
    
    faxNumber: data['faxNumber']?.trim() || data['Fax Number']?.trim() || null,
    address: data['address']?.trim() || data['Address']?.trim() || null,
    city: data['city']?.trim() || data['City']?.trim() || null,
    state: data['state']?.trim() || data['State']?.trim() || null,
    zipCode: data['zipCode']?.trim() || data['Zip Code']?.trim() || data['ZipCode']?.trim() || null,
    jobTitle: data['jobTitle']?.trim() || data['Job Title']?.trim() || 'Professional',
    industry: data['industry']?.trim() || data['Industry']?.trim() || defaultCategory,
    country: data['country']?.trim() || data['Country']?.trim() || 'Unknown',
  };
};

// ==========================================
// 👉 UPGRADED: STREAMED & BATCHED LEAD UPLOAD
// ==========================================
router.post('/:id/upload-leads', requireAuth, requireAdmin, uploadDisk.single('file'), CoreService.catchAsync(async (req: Request | any, res: Response) => {
  const { id } = req.params;
  
  if (!req.file) return CoreService.error(res, 400, 'No file uploaded.');

  // 1. Validate Target Package Exists
  const pkg = await prisma.package.findUnique({ where: { id } });
  if (!pkg) {
    cleanupFile(req.file.path);
    return CoreService.error(res, 404, 'Package not found. Cannot attach leads.');
  }

  // 2. Metrics & Logs Initialization
  const startTime = Date.now();
  const BATCH_SIZE = 2000; // Optimal sweet spot for Prisma bulk inserts
  
  let batch: any[] = [];
  let totalProcessed = 0;
  let totalInserted = 0;
  let skippedRowsCount = 0;
  const errorLogs: string[] = [];

  const isCredentialsPkg = pkg.includesCredentials || pkg.category === 'Email & Password';
  const originalName = (req.file.originalname || '').toLowerCase();
  const isTxtFile = /\.txt$/i.test(originalName);

  console.log(`\n🚀 Starting Bulk Upload [Package ID: ${id}]`);
  console.log(`📁 File Name: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`⚙️  Target Mode: ${isCredentialsPkg ? 'CredentialRecord (Bulk)' : 'MasterLead (Bulk)'}`);

  try {
    // ==========================================
    // BRANCH A: PROCESSING PLAIN TXT FILES (LINE-BY-LINE)
    // ==========================================
    if (isTxtFile) {
      if (!isCredentialsPkg) {
        cleanupFile(req.file.path);
        return CoreService.error(res, 400, 'TXT uploads are only supported for Email & Password credential packages.');
      }

      const fileStream = fs.createReadStream(req.file.path);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      for await (const line of rl) {
        totalProcessed++;
        const trimmed = line.trim();
        if (!trimmed) continue;

        const [emailPart, ...passwordParts] = trimmed.split(':');
        const email = emailPart?.trim() || '';
        const password = passwordParts.join(':').trim();

        if (email && password) {
          batch.push({
            email,
            password,
            username: null,
            website: null,
            notes: null,
          });
        } else {
          skippedRowsCount++;
          if (errorLogs.length < 100) errorLogs.push(`Line ${totalProcessed}: Missing email or password format.`);
        }

        // Process full batches execution
        if (batch.length >= BATCH_SIZE) {
          const insertData = await prisma.credentialRecord.createMany({ data: batch, skipDuplicates: true });
          totalInserted += insertData.count;
          
          console.log(`📊 Progress Log: Read ${totalProcessed} lines | Total Inserted: ${totalInserted}`);
          batch = []; // Free up RAM instantly
        }
      }
    } 
    // ==========================================
    // BRANCH B: PROCESSING CSV FILES (VIA STREAM PASSTHROUGH)
    // ==========================================
    else {
      const parserStream = fs.createReadStream(req.file.path).pipe(csvParser());

      for await (const data of parserStream) {
        totalProcessed++;
        
        if (isCredentialsPkg) {
          const email = data['email']?.trim() || data['Email']?.trim() || data['Email Address']?.trim() || '';
          const password = data['password']?.trim() || data['Password']?.trim() || data['pass']?.trim() || data['Pass']?.trim() || '';

          if (email && password) {
            batch.push({
              email,
              password,
              username: data['username']?.trim() || data['user']?.trim() || null,
              website: data['website']?.trim() || null,
              notes: data['notes']?.trim() || null,
            });
          } else {
            skippedRowsCount++;
            if (errorLogs.length < 100) errorLogs.push(`Row ${totalProcessed}: Missing credentials.`);
          }
        } else {
          const row = normalizeCsvRow(data, pkg.category);
          if (row.email) {
            batch.push({
              ...row,
              workspaceId: req.user.workspaceId,
            });
          } else {
            skippedRowsCount++;
            if (errorLogs.length < 100) errorLogs.push(`Row ${totalProcessed}: Missing valid Email column alignment.`);
          }
        }

        // Process full batches execution
        if (batch.length >= BATCH_SIZE) {
          const insertData = isCredentialsPkg
            ? await prisma.credentialRecord.createMany({ data: batch, skipDuplicates: true })
            : await prisma.masterLead.createMany({ data: batch, skipDuplicates: true });

          totalInserted += insertData.count;
          console.log(`📊 Progress Log: Parsed ${totalProcessed} rows | Total DB Writes: ${totalInserted}`);
          batch = []; // Flush buffer from RAM
        }
      }
    }

    // ==========================================
    // FLUSH FINAL REMAINING CHUNK
    // ==========================================
    if (batch.length > 0) {
      const insertData = isCredentialsPkg
        ? await prisma.credentialRecord.createMany({ data: batch, skipDuplicates: true })
        : await prisma.masterLead.createMany({ data: batch, skipDuplicates: true });
      totalInserted += insertData.count;
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🏁 Complete! Processed: ${totalProcessed} | Saved: ${totalInserted} | Duplicates/Skipped: ${totalProcessed - totalInserted} | Time: ${durationSeconds}s\n`);

    // 3. Complete File Execution Cleanup
    cleanupFile(req.file.path);

    // Return extensive performance payload to front-end metrics dashboard
    return CoreService.success(res, 201, 'Data import telemetry complete', {
      telemetry: {
        totalRowsParsed: totalProcessed,
        newRowsInserted: totalInserted,
        skippedInvalidRows: skippedRowsCount,
        deduplicatedRowsCount: (totalProcessed - totalInserted) - skippedRowsCount,
        executionTimeSeconds: parseFloat(durationSeconds),
        rowsPerSecond: Math.round(totalProcessed / parseFloat(durationSeconds)) || totalProcessed
      },
      errors: errorLogs.length > 0 ? errorLogs : null
    });

  } catch (error: any) {
    cleanupFile(req.file.path);
    console.error("❌ CRITICAL Streaming Crash Log:", error);
    return CoreService.error(res, 500, `Processing failed at row index ${totalProcessed}: ${error.message}`);
  }
}));

export default router;