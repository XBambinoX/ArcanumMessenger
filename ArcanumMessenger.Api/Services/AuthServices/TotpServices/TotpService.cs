using OtpNet;

namespace ArcanumMessenger.Services.AuthServices.TotpServices;

public class TotpService
{
    private const int SecretSize = 20; // 160 bits, standard TOTP secret size
    private const int Digits = 6;
    private const int PeriodSeconds = 30;

    public string GenerateSecret() =>
        Base32Encoding.ToString(KeyGeneration.GenerateRandomKey(SecretSize));

    public string BuildOtpauthUri(string label, string base32Secret) =>
        $"otpauth://totp/Arcanum:{Uri.EscapeDataString(label)}?secret={base32Secret}&issuer=Arcanum&algorithm=SHA1&digits={Digits}&period={PeriodSeconds}";

    public bool VerifyCode(string base32Secret, string code)
    {
        var totp = new Totp(Base32Encoding.ToBytes(base32Secret), step: PeriodSeconds, totpSize: Digits);
        return totp.VerifyTotp(code, out _, new VerificationWindow(previous: 1, future: 1));
    }
}
