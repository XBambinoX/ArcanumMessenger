using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ArcanumMessenger.Services
{
    public class EmailService(IConfiguration config)
    {
        public async Task SendVerificationCodeAsync(string toEmail, string code, CancellationToken ct = default)
        {
            Console.WriteLine("EmailService called");
            var smtp = config.GetSection("Smtp");

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(smtp["FromName"] ?? "Arcanum", smtp["Username"]!));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = $"{code} — your Arcanum verification code";

            message.Body = new TextPart("html")
            {
                Text = BuildEmailHtml(code)
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

        private static string BuildEmailHtml(string code) => $$"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <style>
            body {font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0b1e; margin: 0; padding: 40px 20px; }
            .card {max-width: 420px; margin: 0 auto; background: #13102a; border: 1px solid rgba(124,58,237,0.2); border-radius: 16px; padding: 40px 36px; text-align: center; }
            .logo {font-size: 22px; font-weight: 700; color: #a78bfa; margin-bottom: 8px; }
            .sub {font-size: 13px; color: rgba(148,163,184,0.6); margin-bottom: 32px; letter-spacing: 0.05em; text-transform: uppercase; }
            h1 {font-size: 16px; color: rgba(226,232,240,0.85); font-weight: 500; margin: 0 0 24px; }
            .code {font-size: 40px; font-weight: 800; letter-spacing: 0.15em; background: linear-gradient(135deg, #a78bfa, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin: 0 0 8px; }
            .expires {font-size: 13px; color: rgba(148,163,184,0.5); margin-bottom: 32px; }
            .footer {font-size: 12px; color: rgba(100,116,139,0.5); border-top: 1px solid rgba(124,58,237,0.1); padding-top: 20px; margin-top: 8px; }
          </style>
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
    }
}