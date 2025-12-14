import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

// Dynamic imports for optional dependencies - allows package to install even if these fail
let nodemailer: any;
let ImapFlow: any;
let simpleParser: any;
let emailDependenciesAvailable = false;
let emailDependencyError = '';

try {
  nodemailer = require('nodemailer');
  ImapFlow = require('imapflow').ImapFlow;
  simpleParser = require('mailparser').simpleParser;
  emailDependenciesAvailable = true;
} catch (error) {
  emailDependencyError = error instanceof Error ? error.message : 'Failed to load email dependencies';
}

async function getEtherealAccount(context: IExecuteFunctions): Promise<any> {
  const staticData = context.getWorkflowStaticData('node');
  const now = Date.now();
  const fortyEightHours = 48 * 60 * 60 * 1000;

  // Check if we have cached credentials that are still valid
  if (staticData.etherealAccount) {
    const account = staticData.etherealAccount as any;
    const createdAt = account.createdAt || 0;
    const age = now - createdAt;

    // Reuse if less than 48 hours old
    if (age < fortyEightHours) {
      return account;
    }
  }

  // Generate new Ethereal account via Ethereal's public API
  try {
    const account = await nodemailer.createTestAccount();

    const etherealData = {
      user: account.user,
      pass: account.pass,
      smtp: {
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
      },
      imap: {
        host: 'imap.ethereal.email',
        port: 993,
        secure: true,
      },
      web: account.web || 'https://ethereal.email',
      createdAt: now,
    };

    // Cache in workflow static data for future executions
    staticData.etherealAccount = etherealData;

    return etherealData;
  } catch (error) {
    throw new NodeOperationError(
      context.getNode(),
      `Failed to generate Ethereal test account: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

async function fetchLatestEmail(etherealAccount: any): Promise<any> {
  const client = new ImapFlow({
    host: etherealAccount.imap.host,
    port: etherealAccount.imap.port,
    secure: etherealAccount.imap.secure,
    auth: {
      user: etherealAccount.user,
      pass: etherealAccount.pass,
    },
    logger: false,
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    let emailData = null;

    try {
      // Fetch the latest message
      if (client.mailbox && typeof client.mailbox !== 'boolean' && client.mailbox.exists > 0) {
        const message = await client.fetchOne(client.mailbox.exists, {
          source: true,
          envelope: true,
        });

        if (message && typeof message !== 'boolean' && message.source) {
          // Parse the email content
          const parsed = await simpleParser(message.source);

          const fromAddress = Array.isArray(parsed.from)
            ? parsed.from[0]?.text
            : parsed.from?.text;
          const toAddress = Array.isArray(parsed.to)
            ? parsed.to[0]?.text
            : parsed.to?.text;

          emailData = {
            subject: parsed.subject,
            from: fromAddress,
            to: toAddress,
            date: parsed.date,
            textContent: parsed.text,
            htmlContent: parsed.html,
            headers: Object.fromEntries(parsed.headers),
            attachments: parsed.attachments?.map((att: any) => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
            })) || [],
          };
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return emailData;
  } catch (error) {
    throw new Error(`Failed to fetch email via IMAP: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export class SendEmailTest implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'FlowEngine Send Email Test',
    name: 'sendEmailTest',
    icon: 'file:flowengine.svg',
    group: ['transform'],
    version: 1,
    subtitle: 'Send test email with zero setup',
    description: 'Send a test email with auto-generated credentials (no setup required)',
    defaults: {
      name: 'FlowEngine Send Email Test',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'To Email',
        name: 'toEmail',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'recipient@example.com',
        description: 'The recipient email address',
      },
      {
        displayName: 'Subject',
        name: 'subject',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Test Email Subject',
        description: 'The email subject line',
      },
      {
        displayName: 'Email Body',
        name: 'emailBody',
        type: 'string',
        typeOptions: {
          rows: 10,
        },
        default: '',
        required: true,
        placeholder: 'Your email content here...',
        description: 'The email body content',
      },
      {
        displayName: 'Body Type',
        name: 'bodyType',
        type: 'options',
        options: [
          {
            name: 'Text',
            value: 'text',
            description: 'Plain text email',
          },
          {
            name: 'HTML',
            value: 'html',
            description: 'HTML formatted email',
          },
        ],
        default: 'text',
        description: 'Choose whether the email body is plain text or HTML',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    // Check if email dependencies are available
    if (!emailDependenciesAvailable) {
      throw new NodeOperationError(
        this.getNode(),
        `Email testing dependencies are not available: ${emailDependencyError}. ` +
        'This node requires nodemailer, imapflow, and mailparser packages. ' +
        'Please reinstall the n8n-nodes-flowengine package or contact support.',
      );
    }

    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        // Get parameters
        const toEmail = this.getNodeParameter('toEmail', i) as string;
        const subject = this.getNodeParameter('subject', i) as string;
        const emailBody = this.getNodeParameter('emailBody', i) as string;
        const bodyType = this.getNodeParameter('bodyType', i) as string;

        // Get or generate Ethereal credentials (cached in workflow)
        const etherealAccount = await getEtherealAccount(this);

        // Create nodemailer transporter
        const transporter = nodemailer.createTransport({
          host: etherealAccount.smtp.host,
          port: etherealAccount.smtp.port,
          secure: false,
          auth: {
            user: etherealAccount.user,
            pass: etherealAccount.pass,
          },
        });

        // Prepare mail options
        const mailOptions: any = {
          from: `Test Email <${etherealAccount.user}>`,
          to: toEmail,
          subject: subject,
        };

        if (bodyType === 'html') {
          mailOptions.html = emailBody;
        } else {
          mailOptions.text = emailBody;
        }

        // Send email
        const info = await transporter.sendMail(mailOptions);
        const previewUrl = nodemailer.getTestMessageUrl(info);

        // Wait a moment for email to arrive in IMAP
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Fetch the email content via IMAP
        const emailContent = await fetchLatestEmail(etherealAccount);

        // Return output with embedded email content
        returnData.push({
          json: {
            success: true,
            messageId: info.messageId,
            sentEmail: {
              from: etherealAccount.user,
              to: toEmail,
              subject: subject,
            },
            receivedEmail: emailContent || {
              note: 'Email sent but not yet retrieved from IMAP. Try the preview URL.',
            },
            previewUrl: previewUrl,
            credentials: {
              email: etherealAccount.user,
              password: etherealAccount.pass,
              webUrl: 'https://ethereal.email',
              expiresIn: '48 hours',
            },
            message: '✅ Test email sent successfully!',
            instructions: [
              '1. Check the "receivedEmail" object above for the full email content',
              '2. Or click the preview URL to view in browser',
              '3. Or login to https://ethereal.email with the credentials provided',
              '4. Note: Emails are NOT delivered to real inboxes - this is for testing only',
              '5. Account expires after 48 hours of inactivity',
            ],
          },
          pairedItem: i,
        });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            pairedItem: i,
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
