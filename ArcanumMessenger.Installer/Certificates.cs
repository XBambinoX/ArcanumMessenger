using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.RegularExpressions;

namespace ArcanumMessenger.Installer;

// nginx's certificate. Arcanum makes its own small CA, so a device only has to trust it once,
// and every certificate renewed from it later is trusted along with it.
static partial class Certificates
{
    const string CertName = "arcanum-lan"; // the file names nginx.conf loads
    const int LeafDays = 825; // the most Apple devices accept, even from a CA you trust by hand

    public static string CertsDir(EnvFile env) => env["HTTPS_CERT_DIR"] ?? Paths.DefaultCertsDir;
    public static string CrtPath(EnvFile env) => Path.Combine(CertsDir(env), CertName + ".crt");
    static string KeyPath(EnvFile env) => Path.Combine(CertsDir(env), CertName + ".key");

    // Returns whether nginx needs to pick up a new certificate.
    public static async Task<bool> Setup(EnvFile env)
    {
        Ui.Section("HTTPS certificate");
        string crt = CrtPath(env), key = KeyPath(env);

        if (File.Exists(crt) && File.Exists(key))
        {
            using var current = X509Certificate2.CreateFromPem(File.ReadAllText(crt));
            if (current.NotAfter > DateTime.Now.AddDays(30))
            {
                Ui.Ok($"Using {crt} (valid until {current.NotAfter:d MMM yyyy})");
                return false;
            }

            Ui.Warn($"{crt} expires on {current.NotAfter:d MMM yyyy}");
            using var ca = LoadCa();
            if (ca != null && current.Issuer == ca.Subject)
            {
                if (!Ui.Confirm("Renew it for the same addresses?", true)) return false;
                Issue(ca, Addresses(current), crt, key);
                return true;
            }
            if (!Ui.Confirm("Replace it now?", true)) return false;
        }

        Directory.CreateDirectory(CertsDir(env));
        var choice = Ui.Choose("How should Arcanum get its certificate?",
            "Create one (fine for a home or Tailscale setup)",
            "Use certificate files I already have (e.g. for a domain)");
        if (choice.StartsWith("Create"))
        {
            var addresses = await PickAddresses();
            using var ca = LoadCa() ?? CreateCa();
            Issue(ca, addresses, crt, key);
            await OfferTrust(ca);
        }
        else
        {
            CopyOwn(crt, key);
        }
        return true;
    }

    // The ones people will type, for the summary - without localhost and wildcards.
    public static List<string> PublicAddresses(EnvFile env)
    {
        if (!File.Exists(CrtPath(env))) return [];
        using var cert = X509Certificate2.CreateFromPem(File.ReadAllText(CrtPath(env)));
        return Addresses(cert).Where(a => a is not ("localhost" or "127.0.0.1") && !a.Contains('*')).ToList();
    }

    public static bool IssuedByOwnCa(EnvFile env)
    {
        if (!File.Exists(CrtPath(env))) return false;
        using var cert = X509Certificate2.CreateFromPem(File.ReadAllText(CrtPath(env)));
        using var ca = LoadCa();
        return ca != null && cert.Issuer == ca.Subject;
    }

    public static bool IsSelfSigned(EnvFile env)
    {
        if (!File.Exists(CrtPath(env))) return false;
        using var cert = X509Certificate2.CreateFromPem(File.ReadAllText(CrtPath(env)));
        return cert.Issuer == cert.Subject;
    }

    public static X509Certificate2? LoadCa() =>
        File.Exists(Paths.CaCert) && File.Exists(Paths.CaKey)
            ? X509Certificate2.CreateFromPemFile(Paths.CaCert, Paths.CaKey)
            : null;

    static X509Certificate2 CreateCa()
    {
        using var key = RSA.Create(3072);
        var name = new X500DistinguishedNameBuilder();
        name.AddCommonName($"Arcanum Local CA ({HostName() ?? "server"})");
        name.AddOrganizationName("Arcanum Messenger");

        var request = new CertificateRequest(name.Build(), key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(true, true, 0, true));
        request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.KeyCertSign | X509KeyUsageFlags.CrlSign, true));
        request.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(request.PublicKey, false));
        using var ca = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddYears(10));

        Directory.CreateDirectory(Paths.CaDir);
        File.WriteAllText(Paths.CaCert, ca.ExportCertificatePem() + "\n");
        Paths.WritePrivate(Paths.CaKey, key.ExportPkcs8PrivateKeyPem() + "\n");
        Ui.Ok($"Created a certificate authority: {ca.GetNameInfo(X509NameType.SimpleName, false)}");
        return X509Certificate2.CreateFromPemFile(Paths.CaCert, Paths.CaKey);
    }

    static void Issue(X509Certificate2 ca, IReadOnlyList<string> addresses, string crt, string keyPath)
    {
        using var key = RSA.Create(2048);
        var name = new X500DistinguishedNameBuilder();
        name.AddCommonName("Arcanum Messenger");

        var san = new SubjectAlternativeNameBuilder();
        foreach (var address in addresses)
        {
            if (IPAddress.TryParse(address, out var ip)) san.AddIpAddress(ip);
            else san.AddDnsName(address);
        }

        var request = new CertificateRequest(name.Build(), key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(san.Build());
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
        request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
        request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension([new Oid("1.3.6.1.5.5.7.3.1")], false));
        request.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(request.PublicKey, false));
        request.CertificateExtensions.Add(X509AuthorityKeyIdentifierExtension.CreateFromCertificate(ca, true, false));

        var serial = RandomNumberGenerator.GetBytes(16);
        serial[0] &= 0x7f; // serial numbers must be positive
        var notAfter = new DateTimeOffset(ca.NotAfter) < DateTimeOffset.UtcNow.AddDays(LeafDays)
            ? new DateTimeOffset(ca.NotAfter)
            : DateTimeOffset.UtcNow.AddDays(LeafDays);
        using var cert = request.Create(ca, DateTimeOffset.UtcNow.AddDays(-1), notAfter, serial);

        File.WriteAllText(crt, cert.ExportCertificatePem() + "\n");
        Paths.WritePrivate(keyPath, key.ExportPkcs8PrivateKeyPem() + "\n");
        Ui.Ok($"Certificate for {string.Join(", ", addresses)} (valid until {cert.NotAfter:d MMM yyyy})");
    }

    static List<string> Addresses(X509Certificate2 cert)
    {
        var san = cert.Extensions.OfType<X509SubjectAlternativeNameExtension>().FirstOrDefault();
        if (san == null) return [];
        return san.EnumerateIPAddresses().Select(ip => ip.ToString()).Concat(san.EnumerateDnsNames()).ToList();
    }

    static async Task<List<string>> PickAddresses()
    {
        var picked = new List<string> { "localhost", "127.0.0.1" };
        var found = await DetectAddresses();
        if (found.Count > 0) picked.AddRange(Ui.ChooseMany("Addresses you'll open Arcanum by", found));

        var extra = Ui.AskOptional("Any other addresses? Comma-separated, optional - e.g. a domain or a Tailscale MagicDNS name:");
        foreach (var address in extra.Split([',', ' '], StringSplitOptions.RemoveEmptyEntries))
        {
            if (Uri.CheckHostName(address) is UriHostNameType.Dns or UriHostNameType.IPv4 or UriHostNameType.IPv6) picked.Add(address);
            else Ui.Warn($"Skipped {address} - that's not a host name or an IP address");
        }
        return picked.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    // This machine's LAN and Tailscale addresses plus its hostname - what people will type to reach it.
    static async Task<List<string>> DetectAddresses()
    {
        var found = new List<string>();
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            // A tun device like tailscale0 reports Unknown rather than Up
            if (nic.OperationalStatus is not (OperationalStatus.Up or OperationalStatus.Unknown)) continue;
            if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback || VirtualInterface().IsMatch(nic.Name)) continue;
            found.AddRange(nic.GetIPProperties().UnicastAddresses
                .Select(a => a.Address)
                .Where(ip => ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip) && !ip.ToString().StartsWith("169.254."))
                .Select(ip => ip.ToString()));
        }

        if (Shell.Exists("tailscale"))
        {
            var (code, ips, _) = await Shell.Capture("tailscale", "ip", "-4");
            if (code == 0) found.AddRange(ips.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        }

        if (HostName() is { } host)
        {
            found.Add(host);
            found.Add(host + ".local");
        }
        return found.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    static string? HostName()
    {
        var host = Dns.GetHostName().Split('.')[0];
        return host.Length == 0 || host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ? null : host;
    }

    static async Task OfferTrust(X509Certificate2 ca)
    {
        Ui.Note("Browsers trust the certificate once they trust Arcanum's certificate authority.");
        if (Ui.Confirm("Trust it on this computer?", true)) await Trust.Add(ca, Paths.CaCert);
    }

    static void CopyOwn(string crt, string key)
    {
        string sourceCrt, sourceKey;
        while (true)
        {
            sourceCrt = AskExistingFile("Certificate file (PEM - the full chain if you have one):");
            sourceKey = AskExistingFile("Its private key (PEM):");
            try
            {
                using var check = X509Certificate2.CreateFromPemFile(sourceCrt, sourceKey);
                break;
            }
            catch (Exception e) when (e is CryptographicException or ArgumentException)
            {
                Ui.Warn($"Those files don't make a pair nginx can use: {e.Message}");
            }
        }

        if (!SamePath(sourceCrt, crt)) File.Copy(sourceCrt, crt, true);
        if (!SamePath(sourceKey, key)) Paths.WritePrivate(key, File.ReadAllText(sourceKey));
        Paths.MakePrivate(key);
        using var cert = X509Certificate2.CreateFromPem(File.ReadAllText(crt));
        Ui.Ok($"Using your certificate (valid until {cert.NotAfter:d MMM yyyy})");
    }

    static string AskExistingFile(string question)
    {
        while (true)
        {
            // Windows' "Copy as path" and a file dropped into a terminal come quoted
            var path = Path.GetFullPath(Paths.ExpandHome(Ui.Ask(question).Trim('"', '\'')));
            if (File.Exists(path)) return path;
            Ui.Warn($"No such file: {path}");
        }
    }

    static bool SamePath(string a, string b) => Path.GetFullPath(a) == Path.GetFullPath(b);

    [GeneratedRegex("^(lo|docker|br-|veth|virbr|cni|flannel|vEthernet|utun|bridge|awdl|llw|anpi)", RegexOptions.IgnoreCase)]
    private static partial Regex VirtualInterface();
}
