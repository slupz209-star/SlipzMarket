// src/services/mailer.service.ts
import nodemailer from 'nodemailer';
import { TemplateService } from './template.service.js';
import { SettingsService } from './settings.service.js';

const getTransporter = async () => {
  console.log('📝 [Mailer] 1/5: Fetching settings...');
  const settings = await SettingsService.get();
  const vars = (settings?.customVariables as any) || {};

  const host = vars.SMTP_HOST || process.env.SMTP_HOST;
  // 👇 Force 465 to skip the slow STARTTLS phase
  const port = 465; 
  const isSecure = true; 
  const user = vars.SMTP_USER || process.env.SMTP_USER;

  console.log(`📝 [Mailer] 2/5: Transporter Config Extracted -> Host: ${host} | Port: ${port} | Secure: ${isSecure} | User: ${user}`);

  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: isSecure, 
    auth: {
      user: user,
      pass: vars.SMTP_PASS || process.env.SMTP_PASS,
    },
    family: 4, 
    // 👇 SPEED & STABILITY UPGRADES 👇
    pool: true,              // Reuse the connection for faster subsequent emails
    maxConnections: 1,       // Prevents Gmail from blocking you for too many concurrent connections
    maxMessages: 10,
    connectionTimeout: 20000,// Tell Nodemailer not to panic if the connection takes a few seconds
    socketTimeout: 20000,
    
    logger: true,
    debug: true,
  } as any);
};
export const MailerService = {
  async send({ to, templateName, context, attachments = [] }: any) {
    console.log(`🚀 [Mailer] START: Initiating send to: ${to} for template: ${templateName}`);
    
    try {
      console.log('⏳ [Mailer] 3/5: Rendering email HTML template...');
      const { subject, html } = await TemplateService.render(templateName, context);
      console.log('✅ [Mailer] 3/5 Complete: Template rendered successfully.');

      console.log('⏳ [Mailer] 4/5: Awaiting transporter creation...');
      const transporter = await getTransporter();
      console.log('✅ [Mailer] 4/5 Complete: Transporter created.');

      console.log(`⏳ [Mailer] 5/5: Knocking on the SMTP server door... (Watch for Nodemailer debug logs below)`);
      const info = await transporter.sendMail({
        from: `"SlipZMarket" <${process.env.SMTP_USER}>`,
        to, 
        subject, 
        html, 
        attachments,
      });

      console.log(`✅ [Mailer] SUCCESS: Email dispatched! Message ID: ${info.messageId}`);
      return info;
      
    } catch (error) {
      console.error(`❌ [Mailer] FATAL ERROR CRASH: Pipeline stopped!`);
      console.error(error);
      throw error; // Re-throw so the auth.ts route catches it and shows the 500 error
    }
  }
};