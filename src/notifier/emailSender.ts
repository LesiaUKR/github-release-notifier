import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';

import { config } from '../config';
import { logger } from '../utils/logger';
import { emailsSentTotal } from '../utils/metrics';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.RESEND_FROM,
      to: [to],
      subject,
      html,
    }),
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`Resend API error ${response.status}: ${body}`);

  let emailId = '';
  try {
    emailId = JSON.parse(body).id ?? '';
  } catch {}
  logger.info(`Email sent to ${to} via Resend API${emailId ? `, id: ${emailId}` : ''}`);
}

// SMTP sender (Ethereal for dev, custom SMTP for prod)
let transporterPromise: Promise<Transporter | null> | null = null;

function createTransporter(): Promise<Transporter | null> {
  if (config.SMTP_HOST) {
    logger.info(`Email transporter configured: ${config.SMTP_HOST}:${config.SMTP_PORT}`);
    return Promise.resolve(
      nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        auth:
          config.SMTP_USER && config.SMTP_PASS
            ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
            : undefined,
      })
    );
  }

  if (config.NODE_ENV === 'development') {
    logger.info('Creating Ethereal test email account...');
    return nodemailer.createTestAccount().then(account => {
      logger.info(`Ethereal account created: ${account.user}`);
      return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
    });
  }

  logger.warn('SMTP not configured — emails will not be sent');
  return Promise.resolve(null);
}

function getTransporter(): Promise<Transporter | null> {
  if (!transporterPromise) {
    transporterPromise = createTransporter();
  }
  return transporterPromise;
}

async function sendViaSmtp(to: string, subject: string, html: string): Promise<void> {
  const transporter = await getTransporter();

  if (!transporter) {
    throw new Error('No email transporter configured');
  }

  const info = await transporter.sendMail({
    from: config.SMTP_FROM,
    to,
    subject,
    html,
  });

  logger.info(`Email sent to ${to}, messageId: ${info.messageId}`);

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info(`Preview URL: ${previewUrl}`);
  }
}

// Main send function with retry logic
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const sender = config.RESEND_API_KEY ? sendViaResend : sendViaSmtp;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sender(to, subject, html);
      emailsSentTotal.inc({ status: 'success' });
      return true;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt + 1) * BASE_DELAY_MS;
        logger.warn(
          `Email to ${to} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms:`,
          error
        );
        await sleep(delay);
      } else {
        logger.error(`Email to ${to} failed after ${MAX_RETRIES + 1} attempts:`, error);
        emailsSentTotal.inc({ status: 'failure' });
        return false;
      }
    }
  }

  return false;
}
