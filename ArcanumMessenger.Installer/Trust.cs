using System.Security.Cryptography.X509Certificates;

namespace ArcanumMessenger.Installer;

// Adds Arcanum's CA to this computer's trusted certificates: the system's, and the NSS databases
// that Firefox (everywhere) and Chrome (on Linux) keep for themselves.
static class Trust
{
    const string FileName = "arcanum-ca.crt";

    // Where each Linux family keeps extra trusted CAs, and how it rebuilds its bundle
    static readonly (string Dir, string Tool, string[] Args)[] LinuxStores =
    [
        ("/etc/ca-certificates/trust-source/anchors", "update-ca-trust", []), // Arch
        ("/usr/local/share/ca-certificates", "update-ca-certificates", []), // Debian, Ubuntu, Raspberry Pi OS
        ("/etc/pki/ca-trust/source/anchors", "update-ca-trust", ["extract"]), // Fedora, RHEL
        ("/etc/pki/trust/anchors", "update-ca-certificates", []), // openSUSE
    ];

    public static async Task Add(X509Certificate2 ca, string caPath)
    {
        if (!OperatingSystem.IsWindows() && !Environment.IsPrivilegedProcess)
            Ui.Note("This needs sudo, so it may ask for your password.");

        if (OperatingSystem.IsWindows())
        {
            // The current user's store: no admin needed, Windows asks to confirm instead
            try
            {
                using var publicOnly = X509CertificateLoader.LoadCertificate(ca.RawData); // never the CA's key
                using var store = new X509Store(StoreName.Root, StoreLocation.CurrentUser);
                store.Open(OpenFlags.ReadWrite);
                store.Add(publicOnly);
                Ui.Ok("Trusted by Windows (and the browsers that use its store)");
            }
            catch (Exception e)
            {
                Ui.Warn($"Windows didn't add it: {e.Message}");
            }
            return;
        }

        if (OperatingSystem.IsMacOS())
        {
            var code = Shell.RunAsRoot("security", "add-trusted-cert", "-d", "-r", "trustRoot", "-k", "/Library/Keychains/System.keychain", caPath);
            if (code == 0) Ui.Ok("Trusted in the macOS System keychain");
            else Ui.Warn("macOS didn't add it - open the file in Keychain Access and set it to Always Trust.");
        }
        else if (LinuxStore() is { } store)
        {
            var code = Shell.RunAsRoot("install", "-m", "644", caPath, Path.Combine(store.Dir, FileName));
            if (code == 0) code = Shell.RunAsRoot(store.Tool, store.Args);
            if (code == 0) Ui.Ok("Trusted by the system");
            else Ui.Warn("Couldn't add it to the system's trusted certificates.");
        }
        else
        {
            Ui.Warn("Don't know where this system keeps trusted certificates - add it by hand.");
        }

        await Nss(add: true, ca, caPath);
    }

    public static async Task Remove(X509Certificate2 ca)
    {
        if (OperatingSystem.IsWindows())
        {
            try
            {
                using var store = new X509Store(StoreName.Root, StoreLocation.CurrentUser);
                store.Open(OpenFlags.ReadWrite);
                foreach (var cert in store.Certificates.Find(X509FindType.FindByThumbprint, ca.Thumbprint, false))
                    store.Remove(cert);
            }
            catch
            {
                // best effort
            }
            return;
        }

        if (OperatingSystem.IsMacOS())
        {
            Shell.RunAsRoot("security", "delete-certificate", "-Z", ca.Thumbprint, "/Library/Keychains/System.keychain");
        }
        else if (LinuxStore() is { } store && File.Exists(Path.Combine(store.Dir, FileName)))
        {
            Shell.RunAsRoot("rm", "-f", Path.Combine(store.Dir, FileName));
            Shell.RunAsRoot(store.Tool, store.Args);
        }
        await Nss(add: false, ca, null);
        Ui.Ok("This computer no longer trusts Arcanum's certificate authority");
    }

    static (string Dir, string Tool, string[] Args)? LinuxStore()
    {
        foreach (var store in LinuxStores)
            if (Directory.Exists(store.Dir) && Shell.Exists(store.Tool)) return store;
        return null;
    }

    static async Task Nss(bool add, X509Certificate2 ca, string? caPath)
    {
        var databases = NssDatabases().ToList();
        if (databases.Count == 0) return;
        if (!Shell.Exists("certutil"))
        {
            if (add)
                Ui.Warn("Firefox (and Chrome on Linux) keep their own trusted list - install certutil to add it there too: " +
                        "nss (Arch), libnss3-tools (Debian, Ubuntu), nss-tools (Fedora), brew install nss (macOS).");
            return;
        }

        var name = ca.GetNameInfo(X509NameType.SimpleName, false);
        var done = 0;
        foreach (var db in databases)
        {
            var (code, _, _) = add
                ? await Shell.Capture("certutil", "-d", "sql:" + db, "-A", "-t", "C,,", "-n", name, "-i", caPath!)
                : await Shell.Capture("certutil", "-d", "sql:" + db, "-D", "-n", name);
            if (code == 0) done++;
        }
        if (add && done > 0) Ui.Ok($"Trusted in {done} browser profile(s)");
    }

    static IEnumerable<string> NssDatabases()
    {
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string[] profileRoots =
        [
            ".mozilla/firefox",
            ".config/mozilla/firefox", // newer Firefox on Linux
            ".librewolf",
            "snap/firefox/common/.mozilla/firefox",
            ".var/app/org.mozilla.firefox/.mozilla/firefox",
            "Library/Application Support/Firefox/Profiles",
            "Library/Application Support/librewolf/Profiles",
        ];
        foreach (var root in profileRoots.Select(r => Path.Combine(home, r)).Where(Directory.Exists))
            foreach (var profile in Directory.GetDirectories(root))
                if (File.Exists(Path.Combine(profile, "cert9.db"))) yield return profile;

        var chrome = Path.Combine(home, ".pki", "nssdb"); // Chrome and Chromium on Linux
        if (File.Exists(Path.Combine(chrome, "cert9.db"))) yield return chrome;
    }
}
