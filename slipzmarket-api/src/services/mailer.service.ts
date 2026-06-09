// src/services/mailer.service.ts
import nodemailer from 'nodemailer';
import { TemplateService } from './template.service.js';
import { SettingsService } from './settings.service.js';

const getTransporter = async () => {
  const settings = await SettingsService.get();
  const vars = (settings?.customVariables as any) || {};

  // Default to 587 instead of 465
  const port = Number(vars.SMTP_PORT || process.env.SMTP_PORT || 587);

  return nodemailer.createTransport({
    host: vars.SMTP_HOST || process.env.SMTP_HOST,
    port: port,
    // CRITICAL: secure MUST be true for 465, and MUST be false for 587 or 25
    secure: port === 465, 
    auth: {
      user: vars.SMTP_USER || process.env.SMTP_USER,
      pass: vars.SMTP_PASS || process.env.SMTP_PASS,
    },
    family: 4, // Keep the IPv4 fix we added earlier
  } as any);
};

export const MailerService = {
  async send({ to, templateName, context, attachments = [] }: any) {
    const { subject, html } = await TemplateService.render(templateName, context);
    const transporter = await getTransporter();
    
    return await transporter.sendMail({
      from: `"SlipZMarket" <${process.env.SMTP_USER}>`,
      to, 
      subject, 
      html, 
      attachments,
    });
  }
};