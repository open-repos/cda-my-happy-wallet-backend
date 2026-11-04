import { isIP } from "net";
import nodemailer from "nodemailer";
import {
  EMAIL_SENDER,
  NODE_ENV,
  SMTP_HOST,
  SMTP_PASSWORD,
  SMTP_PORT,
  SMTP_REQUIRE_TLS,
  SMTP_RETURN_PATH,
  SMTP_SECURE,
  SMTP_USER,
} from "../../../config/config";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { htmlToText } from "./htmlToText";
import { IMailer } from "./Mailer.interface";

const SMTP_TIMEOUT_MS = 10_000;
const LOCAL_SENDER = "no-reply@myhappywallet.local";

interface MailTransport {
  sendMail(options: {
    envelope?: { from: string; to: string };
    from: string;
    html: string;
    subject: string;
    text: string;
    to: string;
  }): Promise<unknown>;
}

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  user?: string;
  password?: string;
  sender?: string;
  returnPath?: string;
  production: boolean;
  timeoutMs?: number;
};

type MailFailureCategory =
  | "authentication"
  | "configuration"
  | "dns"
  | "network"
  | "permanent_rejection"
  | "timeout"
  | "tls"
  | "transient_rejection";

type MailFailureDiagnostic = {
  provider: "smtp";
  category: MailFailureCategory;
  code?: string;
  networkCode?: string;
  responseCode?: number;
};

type DiagnosticReporter = (diagnostic: MailFailureDiagnostic) => void;

const reportToStderr: DiagnosticReporter = (diagnostic) => {
  console.error("mail_delivery_failed", diagnostic);
};

const defaultSettings: SmtpSettings = {
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  requireTLS: SMTP_REQUIRE_TLS,
  user: SMTP_USER,
  password: SMTP_PASSWORD,
  sender: EMAIL_SENDER,
  returnPath: SMTP_RETURN_PATH,
  production: NODE_ENV === "production",
};

const isInternalHost = (host: string): boolean => {
  if (host === "localhost" || host === "::1") return true;
  if (isIP(host) !== 4) return false;
  const [first, second] = host.split(".").map(Number);
  return (
    first === 127 ||
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

/** Returns null for a configuration that must not be allowed to send. */
export const smtpTransportOptions = (settings: SmtpSettings) => {
  const { port, secure, requireTLS, production } = settings;
  const host = settings.host.trim();
  const user = settings.user?.trim();
  const password = settings.password?.trim() ? settings.password : undefined;
  const returnPath = settings.returnPath?.trim();
  const encrypted = secure || requireTLS;
  const timeout = settings.timeoutMs ?? SMTP_TIMEOUT_MS;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  // The envelope takes a bare address, unlike the "Name <address>" header form.
  if (returnPath && !/^[^\s<>@]+@[^\s<>@]+$/.test(returnPath)) return null;
  if (Boolean(user) !== Boolean(password)) return null;
  // Credentials never travel in clear, and clear text only stays on a private link.
  if (user && !encrypted) return null;
  if (production && !encrypted && !isInternalHost(host)) return null;

  return {
    host,
    port,
    secure,
    requireTLS,
    // Without this, an advertised STARTTLS is attempted and fails on a private IP's certificate.
    ignoreTLS: !encrypted,
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,
    ...(user && password ? { auth: { user, pass: password } } : {}),
  };
};

const safeCode = (value: unknown): string | undefined =>
  typeof value === "string" && /^[A-Z0-9_]{2,64}$/.test(value)
    ? value
    : undefined;

const isTlsCode = (code = ""): boolean =>
  code === "ETLS" ||
  code === "EREQUIRETLS" ||
  ["ERR_TLS_", "ERR_SSL_", "ERR_OSSL_", "CERT_", "UNABLE_TO_"].some((prefix) =>
    code.startsWith(prefix)
  ) ||
  ["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN"].includes(code);

const failureCategory = (
  code?: string,
  networkCode?: string,
  responseCode?: number
): MailFailureCategory => {
  if (code === "EAUTH" || code === "ENOAUTH") return "authentication";
  if (isTlsCode(code) || isTlsCode(networkCode)) return "tls";
  if (responseCode !== undefined && responseCode >= 500) {
    return "permanent_rejection";
  }
  if (responseCode !== undefined && responseCode >= 400) {
    return "transient_rejection";
  }
  if (
    code === "EDNS" ||
    ["ENOTFOUND", "EAI_AGAIN"].includes(networkCode ?? "")
  ) {
    return "dns";
  }
  if (code === "ETIMEDOUT" || networkCode === "ETIMEDOUT") return "timeout";
  return "network";
};

// Allow-lists codes only: a Nodemailer error also carries the server response and recipients.
const failureDiagnostic = (error: unknown): MailFailureDiagnostic => {
  const candidate = error as {
    code?: unknown;
    originalCode?: unknown;
    responseCode?: unknown;
  };
  const code = safeCode(candidate?.code);
  const networkCode = safeCode(candidate?.originalCode);
  const responseCode =
    typeof candidate?.responseCode === "number"
      ? candidate.responseCode
      : undefined;

  return {
    provider: "smtp",
    category: failureCategory(code, networkCode, responseCode),
    ...(code ? { code } : {}),
    ...(networkCode ? { networkCode } : {}),
    ...(responseCode !== undefined ? { responseCode } : {}),
  };
};

export class SmtpMailer implements IMailer {
  private readonly transport: MailTransport | null;
  private readonly sender?: string;
  private readonly returnPath?: string;

  constructor(
    transport?: MailTransport,
    settings: SmtpSettings = defaultSettings,
    private readonly reportDiagnostic: DiagnosticReporter = reportToStderr
  ) {
    const options = smtpTransportOptions(settings);
    this.transport =
      transport ?? (options ? nodemailer.createTransport(options) : null);
    this.sender =
      settings.sender?.trim() ||
      (settings.production ? undefined : LOCAL_SENDER);
    this.returnPath = settings.returnPath?.trim() || undefined;
  }

  public async sendMail(
    email: string,
    subject: string,
    text: string
  ): Promise<boolean> {
    if (!this.transport || !this.sender) {
      this.reportDiagnostic({ provider: "smtp", category: "configuration" });
      throw new ErrorException(ErrorCode.SendEmaillError);
    }

    try {
      await this.transport.sendMail({
        ...(this.returnPath
          ? { envelope: { from: this.returnPath, to: email } }
          : {}),
        from: this.sender,
        html: text,
        text: htmlToText(text),
        subject,
        to: email,
      });
      return true;
    } catch (error) {
      this.reportDiagnostic(failureDiagnostic(error));
      throw new ErrorException(ErrorCode.SendEmaillError);
    }
  }
}
