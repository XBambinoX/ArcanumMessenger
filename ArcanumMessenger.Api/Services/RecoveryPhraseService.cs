using NBitcoin;

namespace ArcanumMessenger.Services;

public static class RecoveryPhraseService
{
    public static string Generate()
    {
        var mnemo = new Mnemonic(Wordlist.English, WordCount.Twelve);
        return string.Join('-', mnemo.Words);
    }
}