using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ArcanumMessenger.Services.AuthServices.RegisterServices
{
    public class EmailService(IConfiguration config)
    {
        public Task SendVerificationCodeAsync(string toEmail, string code, CancellationToken ct = default) =>
            SendAsync(
                toEmail,
                $"{code} — your Arcanum verification code",
                BuildCodeHtml(code),
                ct);

        // Sent instead of a code when someone tries to register an email
        // that already has an account. The register flow looks identical
        // from the outside either way, so only the mailbox owner learns
        // the address is taken.
        public Task SendAccountExistsNoticeAsync(string toEmail, CancellationToken ct = default) =>
            SendAsync(
                toEmail,
                "Your email was used on Arcanum",
                BuildAccountExistsHtml(),
                ct);

        private async Task SendAsync(string toEmail, string subject, string html, CancellationToken ct)
        {
            var smtp = config.GetSection("Smtp");

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(smtp["FromName"] ?? "Arcanum", smtp["Username"]!));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;

            message.Body = new TextPart("html")
            {
                Text = html
            };

            using var client = new SmtpClient();

            await client.ConnectAsync(
                smtp["Host"]!,
                int.Parse(smtp["Port"] ?? "587"),
                SecureSocketOptions.StartTls,
                ct
            );

            await client.AuthenticateAsync(smtp["Username"]!, smtp["Password"]!, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);
        }

        private const string EmailStyles = """
            body {font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0b1e; margin: 0; padding: 40px 20px; }
            .card {max-width: 420px; margin: 0 auto; background: #13102a; border: 1px solid rgba(124,58,237,0.2); border-radius: 16px; padding: 40px 36px; text-align: center; }
            .logo {font-size: 22px; font-weight: 700; color: #a78bfa; margin-bottom: 8px; }
            .sub {font-size: 13px; color: rgba(148,163,184,0.6); margin-bottom: 32px; letter-spacing: 0.05em; text-transform: uppercase; }
            h1 {font-size: 16px; color: rgba(226,232,240,0.85); font-weight: 500; margin: 0 0 24px; }
            .code {font-size: 40px; font-weight: 800; letter-spacing: 0.15em; background: linear-gradient(135deg, #a78bfa, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin: 0 0 8px; }
            .text {font-size: 14px; color: rgba(226,232,240,0.75); line-height: 1.6; margin: 0 0 24px; text-align: left; }
            .expires {font-size: 13px; color: rgba(148,163,184,0.5); margin-bottom: 32px; }
            .footer {font-size: 12px; color: rgba(100,116,139,0.5); border-top: 1px solid rgba(124,58,237,0.1); padding-top: 20px; margin-top: 8px; }
        """;

        private static string BuildCodeHtml(string code) => $$"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <style>{{EmailStyles}}</style>
        </head>
        <body>
          <div class="card">
            <div class="logo">Arcanum</div>
            <div class="sub">Messenger</div>
            <h1>Your verification code</h1>
            <div class="code">{{code}}</div>
            <div class="expires">Expires in 3 minutes</div>
            <div class="footer">If you didn't request this, you can safely ignore this email.</div>
          </div>
        </body>
        </html>
        """;

        private static string BuildAccountExistsHtml() => $$"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <style>{{EmailStyles}}</style>
        </head>
        <body>
          <div class="card">
            <div class="logo">Arcanum</div>
            <div class="sub">Messenger</div>
            <h1>Someone tried to sign up with your email</h1>
            <p class="text">A new account was requested with this email address, but it already belongs to an existing Arcanum account.</p>
            <p class="text">If that was you – just sign in instead, or use account recovery if you forgot your password.</p>
            <div class="footer">If this wasn't you, no action is needed. Your account is safe and nothing has changed.</div>
          </div>
        </body>
        </html>
        """;
    }
}
