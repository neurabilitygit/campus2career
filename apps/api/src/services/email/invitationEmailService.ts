import { AppError } from "../../utils/appError";

export interface HouseholdInvitationEmailInput {
  invitedEmail: string;
  invitedPersona: "student" | "coach";
  inviterName: string | null;
  householdName: string | null;
  inviteLink: string;
  expiresAt: string;
}

export interface InvitationEmailDeliveryResult {
  provider: "sendgrid" | "development_log";
  state: "sent" | "logged";
  message: string;
}

export interface InvitationEmailService {
  sendHouseholdInvitation(input: HouseholdInvitationEmailInput): Promise<InvitationEmailDeliveryResult>;
}

function env(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function baseUrl() {
  return env("NEXT_PUBLIC_APP_URL") || env("APP_BASE_URL") || "http://localhost:3000";
}

function subjectForPersona(persona: "student" | "coach", householdName: string | null) {
  const household = householdName?.trim() || "a Campus2Career household";
  return persona === "coach"
    ? `Coach invitation for ${household}`
    : `Student invitation for ${household}`;
}

function bodyCopy(input: HouseholdInvitationEmailInput) {
  const inviter = input.inviterName?.trim() || "A household administrator";
  const household = input.householdName?.trim() || "their household";
  const expires = new Date(input.expiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  });

  return {
    greeting: input.invitedPersona === "coach" ? "You have been invited to join a Campus2Career household as a coach." : "You have been invited to join a Campus2Career household as a student.",
    inviter,
    household,
    expires,
  };
}

function htmlForInvitation(input: HouseholdInvitationEmailInput) {
  const copy = bodyCopy(input);
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#10233c">
      <h2 style="margin:0 0 12px">Campus2Career invitation</h2>
      <p style="margin:0 0 12px">${copy.greeting}</p>
      <p style="margin:0 0 12px"><strong>${copy.inviter}</strong> invited you to join <strong>${copy.household}</strong>.</p>
      <p style="margin:0 0 20px">This link expires on <strong>${copy.expires}</strong>.</p>
      <p style="margin:0 0 20px">
        <a href="${input.inviteLink}" style="display:inline-block;background:#173d6b;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">
          Accept invitation
        </a>
      </p>
      <p style="margin:0 0 8px">If the button does not work, copy and paste this link into your browser:</p>
      <p style="margin:0;word-break:break-word"><a href="${input.inviteLink}">${input.inviteLink}</a></p>
      <p style="margin:20px 0 0;color:#52657d">This message was sent from ${baseUrl()}.</p>
    </div>
  `.trim();
}

function textForInvitation(input: HouseholdInvitationEmailInput) {
  const copy = bodyCopy(input);
  return [
    "Campus2Career invitation",
    "",
    copy.greeting,
    `${copy.inviter} invited you to join ${copy.household}.`,
    `This link expires on ${copy.expires}.`,
    "",
    `Accept invitation: ${input.inviteLink}`,
    "",
    `Sent from ${baseUrl()}.`,
  ].join("\n");
}

class DevelopmentLogInvitationEmailService implements InvitationEmailService {
  async sendHouseholdInvitation(input: HouseholdInvitationEmailInput): Promise<InvitationEmailDeliveryResult> {
    console.log(
      `[household-invitation] ${input.invitedPersona} -> ${input.invitedEmail} ${input.inviteLink}`
    );
    return {
      provider: "development_log",
      state: "logged",
      message: "Invitation created. Development link logged for local testing.",
    };
  }
}

class SendGridInvitationEmailService implements InvitationEmailService {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string,
    private readonly replyToEmail: string | null
  ) {}

  async sendHouseholdInvitation(input: HouseholdInvitationEmailInput): Promise<InvitationEmailDeliveryResult> {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.invitedEmail }] }],
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        reply_to: this.replyToEmail
          ? {
              email: this.replyToEmail,
              name: this.fromName,
            }
          : undefined,
        subject: subjectForPersona(input.invitedPersona, input.householdName),
        content: [
          { type: "text/plain", value: textForInvitation(input) },
          { type: "text/html", value: htmlForInvitation(input) },
        ],
      }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new AppError({
        status: 502,
        code: "invitation_email_send_failed",
        message: "The invitation email could not be delivered by the configured provider.",
        details: {
          provider: "sendgrid",
          status: response.status,
          responseText: responseText.slice(0, 500),
        },
      });
    }

    return {
      provider: "sendgrid",
      state: "sent",
      message: "Invitation created and emailed successfully.",
    };
  }
}

export function createInvitationEmailService(): InvitationEmailService {
  const provider = env("INVITATION_EMAIL_PROVIDER") || "auto";
  const sendgridApiKey = env("SENDGRID_API_KEY");
  const fromEmail = env("INVITATION_EMAIL_FROM") || env("SENDGRID_FROM_EMAIL");
  const fromName = env("INVITATION_EMAIL_FROM_NAME") || "Campus2Career";
  const replyToEmail = env("SENDGRID_REPLY_TO_EMAIL");

  const sendgridAvailable = !!sendgridApiKey && !!fromEmail;
  if (provider === "sendgrid" && !sendgridAvailable) {
    throw new AppError({
      status: 500,
      code: "invitation_email_provider_misconfigured",
      message: "SendGrid invitation email delivery is enabled but required configuration is missing.",
      details: {
        missing: [
          !sendgridApiKey ? "SENDGRID_API_KEY" : null,
          !fromEmail ? "INVITATION_EMAIL_FROM or SENDGRID_FROM_EMAIL" : null,
        ].filter(Boolean),
      },
    });
  }

  if (provider === "sendgrid" || (provider === "auto" && sendgridAvailable)) {
    return new SendGridInvitationEmailService(sendgridApiKey!, fromEmail!, fromName, replyToEmail);
  }

  return new DevelopmentLogInvitationEmailService();
}

export const invitationEmailService = createInvitationEmailService();
