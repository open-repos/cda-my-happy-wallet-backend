import {
  NODE_ENV,
  SENDGRID_API_KEY,
  EMAIL_SENDER,
} from "../../../config/config";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { IMailer } from "./Mailer.interface";

/** The application only needs SendGrid's Mail Send endpoint, not the SDK. */
export class SendGridMailer implements IMailer {
  constructor(
    private readonly request: typeof fetch = globalThis.fetch,
    private readonly timeoutMs = 10_000
  ) {}

  public async sendMail(
    email: string,
    subject: string,
    text: string
  ): Promise<boolean> {
    try {
      if (!SENDGRID_API_KEY?.trim() || !EMAIL_SENDER?.trim()) {
        throw new Error("Missing mail configuration");
      }
      const trackingEnabled = NODE_ENV === "production";
      const response = await this.request(
        "https://api.sendgrid.com/v3/mail/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
          redirect: "manual",
          signal: AbortSignal.timeout(this.timeoutMs),
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: EMAIL_SENDER },
            subject,
            content: [{ type: "text/html", value: text }],
            tracking_settings: {
              click_tracking: {
                enable: trackingEnabled,
                enable_text: trackingEnabled,
              },
              open_tracking: { enable: trackingEnabled },
            },
          }),
        }
      );
      // No response data is needed. Release the stream without parsing or logging
      // provider errors, and preserve an already acknowledged send on cleanup failure.
      await response.body?.cancel().catch(() => undefined);
      if (!response.ok) throw new Error("Mail provider rejected the request");
      return response.status === 202;
    } catch {
      throw new ErrorException(ErrorCode.SendEmaillError);
    }
  }
}
