// src/services/mailer.service.ts
import dns from 'dns/promises';
import nodemailer from 'nodemailer';
import { TemplateService } from './template.service.js';
import { SettingsService } from './settings.service.js';

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedTransporterKey = '';

const resolveIPv4 = async (hostname: string) => {
  try {
    const addresses = await dns.resolve4(hostname);
    return addresses?.[0] || hostname;
  } catch (error) {
    console.warn(`[Mailer] IPv4 resolution failed for ${hostname}. Using original host.`, error);
    return hostname;
  }
};

const buildTransporterConfig = async () => {
  const settings = await SettingsService.get();
  const vars = (settings?.customVariables as any) || {};

  const host = vars.SMTP_HOST || process.env.SMTP_HOST;
  const smtpHostName = host;
  const resolvedHost = host && !/^\d+\.\d+\.\d+\.\d+$/.test(host) ? await resolveIPv4(host) : host;
  const port = Number(vars.SMTP_PORT || process.env.SMTP_PORT || 465);
  const isSecure = vars.SMTP_SECURE != null ? String(vars.SMTP_SECURE) === 'true' : port === 465;
  const user = vars.SMTP_USER || process.env.SMTP_USER;
  const pass = vars.SMTP_PASS || process.env.SMTP_PASS;

  if (!resolvedHost || !user || !pass) {
    throw new Error('SMTP configuration is incomplete. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
  }

  return {
    host: resolvedHost,
    name: smtpHostName,
    tls: { servername: smtpHostName },
    port,
    secure: isSecure,
    auth: { user, pass },
    family: 4,
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    connectionTimeout: 20000,
    socketTimeout: 20000,
    logger: process.env.NODE_ENV !== 'production',
    debug: process.env.NODE_ENV !== 'production',
  } as any;
};

const getTransporter = async (config?: any) => {
  const transporterConfig = config || await buildTransporterConfig();
  const transporterKey = `${transporterConfig.host}:${transporterConfig.port}:${transporterConfig.secure}:${transporterConfig.auth.user}`;

  if (cachedTransporter && cachedTransporterKey === transporterKey) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport(transporterConfig);
  cachedTransporterKey = transporterKey;

  try {
    await cachedTransporter.verify();
  } catch (err) {
    cachedTransporter = null;
    cachedTransporterKey = '';
    throw new Error(`SMTP transporter verification failed: ${err}`);
  }

  return cachedTransporter;
};

export const MailerService = {
  async send({ to, templateName, context, attachments = [] }: any) {
    console.log(`🚀 [Mailer] START: Initiating send to: ${to} for template: ${templateName}`);

    try {
      console.log('⏳ [Mailer] 3/5: Rendering email HTML template...');
      const { subject, html } = await TemplateService.render(templateName, context);
      console.log('✅ [Mailer] 3/5 Complete: Template rendered successfully.');

      console.log('⏳ [Mailer] 4/5: Resolving SMTP transporter...');
      const config = await buildTransporterConfig();
      const transporter = await getTransporter(config);
      console.log('✅ [Mailer] 4/5 Complete: SMTP transporter ready.');

      const fromAddress = process.env.SMTP_FROM || `SlipZMarket <${config.auth.user}>`;
      console.log(`⏳ [Mailer] 5/5: Sending email to ${to} from ${fromAddress}`);

      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        attachments,
      });

      console.log(`✅ [Mailer] SUCCESS: Email dispatched! Message ID: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error('❌ [Mailer] FATAL ERROR CRASH: Pipeline stopped!');
      console.error(error);
      throw error;
    }
  }
};

