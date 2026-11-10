// SmartHome.exe - starts the app on this computer with a double click.
//
// First run: gets Node.js if it is missing (a private copy under .runtime), installs the
// packages, builds the screens and writes backend\.env with fresh secrets. Every run: starts
// the server on 127.0.0.1 (this computer only) and opens the browser. Closing the window
// stops the server and the database cleanly.
//
// Built by launcher\build.ps1 with the C# compiler that ships with Windows (C# 5).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("SmartHome")]
[assembly: System.Reflection.AssemblyProduct("SmartHome")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

namespace SmartHome
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LauncherForm());
        }
    }

    internal sealed class LauncherForm : Form
    {
        private const int Port = 5180;
        private const string NodeVersion = "22.23.4";
        private static readonly string AppUrl = "http://localhost:" + Port;
        private static readonly string HealthUrl = "http://127.0.0.1:" + Port + "/api/health";

        // The full folder name: build tools treat a short name (PROGRA~1) as a different folder
        private readonly string root = LongPath(AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\'));

        [System.Runtime.InteropServices.DllImport("kernel32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
        private static extern uint GetLongPathName(string shortPath, StringBuilder longPath, uint size);

        private static string LongPath(string path)
        {
            var buffer = new StringBuilder(1024);
            uint length = GetLongPathName(path, buffer, (uint)buffer.Capacity);
            return length > 0 && length < buffer.Capacity ? buffer.ToString() : path;
        }
        private readonly Label title = new Label();
        private readonly Label status = new Label();
        private readonly Label detail = new Label();
        private readonly Button openButton = new Button();
        private readonly Button logButton = new Button();
        private readonly Button stopButton = new Button();
        private Process server;
        private StreamWriter log;
        private volatile bool closing;

        public LauncherForm()
        {
            Text = "SmartHome";
            RightToLeft = RightToLeft.Yes;
            RightToLeftLayout = true;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(460, 220);
            Font = new Font("Segoe UI", 10f);
            BackColor = Color.White;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            title.Text = "SmartHome - ניהול משק הבית";
            title.Font = new Font("Segoe UI", 14f, FontStyle.Bold);
            title.SetBounds(20, 18, 420, 32);

            status.Font = new Font("Segoe UI", 11f);
            status.SetBounds(20, 62, 420, 28);

            detail.ForeColor = Color.DimGray;
            detail.SetBounds(20, 92, 420, 56);

            openButton.Text = "פתיחה בדפדפן";
            openButton.SetBounds(300, 164, 140, 36);
            openButton.Enabled = false;
            openButton.Click += delegate { OpenBrowser(); };

            stopButton.Text = "סגירת המערכת";
            stopButton.SetBounds(150, 164, 140, 36);
            stopButton.Click += delegate { Close(); };

            logButton.Text = "פרטי התקלה";
            logButton.SetBounds(20, 164, 120, 36);
            logButton.Visible = false;
            logButton.Click += delegate { Process.Start("notepad.exe", Quote(LogPath)); };

            Controls.AddRange(new Control[] { title, status, detail, openButton, stopButton, logButton });
            Shown += delegate { new Thread(Start) { IsBackground = true }.Start(); };
        }

        private string LogPath { get { return Path.Combine(root, "smarthome.log"); } }

        // ---------- The steps ----------

        private void Start()
        {
            try
            {
                if (!File.Exists(Path.Combine(root, "backend", "package.json")))
                {
                    Fail("הקובץ צריך להיות בתיקייה הראשית של הפרויקט", "העבירו את SmartHome.exe לתיקייה שבה נמצאות התיקיות backend ו-frontend.");
                    return;
                }
                if (IsRunning())
                {
                    SetStatus("המערכת כבר פועלת", "פותחים אותה בדפדפן. החלון הזה ייסגר.");
                    OpenBrowser();
                    Thread.Sleep(2500);
                    Ui(Close);
                    return;
                }

                log = new StreamWriter(LogPath, false, new UTF8Encoding(false)) { AutoFlush = true };
                Log("SmartHome launcher, " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));

                string node = FindNode();
                string npm = Path.Combine(Path.GetDirectoryName(node), "node_modules", "npm", "bin", "npm-cli.js");
                if (!File.Exists(npm)) throw new StepFailed("לא נמצא npm ליד Node.js", npm);

                InstallPackages(node, npm, "backend");
                InstallPackages(node, npm, "frontend");
                BuildScreens(node, npm);
                EnsureSecrets();
                StartServer(node);
            }
            catch (StepFailed err)
            {
                Log("FAILED: " + err.Message + " " + err.Detail);
                Fail(err.Message, err.Detail);
            }
            catch (Exception err)
            {
                Log("FAILED: " + err);
                Fail("משהו השתבש בהפעלה", err.Message);
            }
        }

        /** Node.js 18 or newer that is installed, or a private copy downloaded once. */
        private string FindNode()
        {
            // A short folder of this user: the zip's deepest paths must stay under 260 characters
            string runtime = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SmartHome");
            string home = Path.Combine(runtime, "node-v" + NodeVersion);
            string local = Path.Combine(home, "node.exe");
            if (File.Exists(local)) return local;

            foreach (string dir in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';'))
            {
                try
                {
                    string candidate = Path.Combine(dir.Trim().Trim('"'), "node.exe");
                    if (dir.Trim().Length > 0 && File.Exists(candidate) && IsSupported(InstalledVersion(candidate))) return candidate;
                }
                catch (ArgumentException) { }
            }

            SetStatus("מורידים את Node.js", "פעם ראשונה בלבד, כ-30MB. צריך חיבור לאינטרנט.");
            string name = "node-v" + NodeVersion + "-win-x64";
            string zip = Path.Combine(runtime, name + ".zip");
            Directory.CreateDirectory(runtime);
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
            using (var web = new WebClient())
            {
                web.DownloadFile("https://nodejs.org/dist/v" + NodeVersion + "/" + name + ".zip", zip);
            }
            string unpacked = Path.Combine(runtime, name);
            if (Directory.Exists(unpacked)) Directory.Delete(unpacked, true);
            if (Directory.Exists(home)) Directory.Delete(home, true);
            ZipFile.ExtractToDirectory(zip, runtime);
            Directory.Move(unpacked, home);
            File.Delete(zip);
            return local;
        }

        /** What the project's tools accept (ESLint 10): Node 20.19+, 22.13+ or 24+. Older ones get a fresh copy. */
        private static bool IsSupported(Version v)
        {
            return v.Major >= 24 || (v.Major == 22 && v.Minor >= 13) || (v.Major == 20 && v.Minor >= 19);
        }

        private static Version InstalledVersion(string node)
        {
            try
            {
                var info = new ProcessStartInfo(node, "-v") { UseShellExecute = false, RedirectStandardOutput = true, CreateNoWindow = true };
                using (var p = Process.Start(info))
                {
                    string version = p.StandardOutput.ReadToEnd().Trim().TrimStart('v');
                    p.WaitForExit(5000);
                    return new Version(version);
                }
            }
            catch { return new Version(0, 0); }
        }

        /** npm install, only when the package list changed since the last time. */
        private void InstallPackages(string node, string npm, string folder)
        {
            string dir = Path.Combine(root, folder);
            string lockFile = Path.Combine(dir, "package-lock.json");
            string stamp = Path.Combine(dir, "node_modules", ".smarthome-installed");
            Func<string> packages = () => Hash(File.ReadAllBytes(File.Exists(lockFile) ? lockFile : Path.Combine(dir, "package.json")));
            if (File.Exists(stamp) && File.ReadAllText(stamp) == packages()) return;

            SetStatus(folder == "backend" ? "מתקינים את רכיבי השרת" : "מתקינים את רכיבי המסכים",
                "פעם ראשונה, או אחרי עדכון. זה יכול לקחת כמה דקות, כולל הורדת מסד הנתונים.");
            RunStep(node, Quote(npm) + " install --no-audit --no-fund", dir, "ההתקנה נכשלה");
            // After the install: npm may have rewritten the lock file
            File.WriteAllText(stamp, packages());
        }

        /** The screens are built once, and again only after their code changed. */
        private void BuildScreens(string node, string npm)
        {
            string dir = Path.Combine(root, "frontend");
            string built = Path.Combine(dir, "dist", "index.html");
            DateTime newest = new[] { "src", "public" }
                .Select(d => Path.Combine(dir, d))
                .Where(Directory.Exists)
                .SelectMany(d => Directory.GetFiles(d, "*", SearchOption.AllDirectories))
                .Concat(Directory.GetFiles(dir, "*.*").Where(f => !f.EndsWith(".log")))
                .Select(File.GetLastWriteTimeUtc)
                .DefaultIfEmpty(DateTime.MinValue)
                .Max();
            if (File.Exists(built) && File.GetLastWriteTimeUtc(built) >= newest) return;

            SetStatus("מכינים את המסכים", "פעם ראשונה, או אחרי עדכון. פחות מדקה.");
            RunStep(node, Quote(npm) + " run build", dir, "הכנת המסכים נכשלה");
        }

        /** backend\.env with secrets of this computer only. An existing file is left as it is. */
        private void EnsureSecrets()
        {
            string env = Path.Combine(root, "backend", ".env");
            if (File.Exists(env)) return;
            var text = new StringBuilder();
            text.AppendLine("# Written by SmartHome.exe on first run. Secrets of this computer only: never share or commit.");
            text.AppendLine("JWT_SECRET=" + RandomHex(48));
            text.AppendLine("JWT_REFRESH_SECRET=" + RandomHex(48));
            text.AppendLine("ENCRYPTION_KEY=" + RandomHex(48));
            File.WriteAllText(env, text.ToString(), new UTF8Encoding(false));
            Log("Wrote backend\\.env with new secrets");
        }

        private void StartServer(string node)
        {
            SetStatus("מפעילים את המערכת", "בפעם הראשונה מסד הנתונים מורד ומוכן, וזה יכול לקחת כמה דקות.");
            var info = new ProcessStartInfo(node, Quote(Path.Combine("src", "server.js")))
            {
                WorkingDirectory = Path.Combine(root, "backend"),
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
            };
            PrepareEnvironment(info, node);
            info.EnvironmentVariables["NODE_ENV"] = "development";
            info.EnvironmentVariables["PORT"] = Port.ToString();
            info.EnvironmentVariables["HOST"] = "127.0.0.1";
            info.EnvironmentVariables["FRONTEND_DIR"] = Path.Combine(root, "frontend", "dist");
            info.EnvironmentVariables["CLIENT_URL"] = AppUrl + ",http://127.0.0.1:" + Port;
            info.EnvironmentVariables["TRUST_PROXY"] = "0";
            info.EnvironmentVariables["STOP_WITH_LAUNCHER"] = "true";

            server = new Process { StartInfo = info, EnableRaisingEvents = true };
            server.OutputDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
            server.ErrorDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
            server.Exited += delegate
            {
                if (closing) return;
                Fail("המערכת נעצרה", "אפשר לנסות להפעיל שוב. אם זה חוזר, הפרטים בקובץ smarthome.log.");
            };
            server.Start();
            server.BeginOutputReadLine();
            server.BeginErrorReadLine();

            DateTime until = DateTime.Now.AddMinutes(15);
            while (DateTime.Now < until && !server.HasExited)
            {
                if (IsRunning())
                {
                    SetStatus("המערכת פועלת", "הכתובת: " + AppUrl + "\nכל עוד החלון הזה פתוח, המערכת פועלת. אפשר למזער אותו.");
                    Ui(delegate { openButton.Enabled = true; });
                    OpenBrowser();
                    return;
                }
                Thread.Sleep(1000);
            }
            if (!server.HasExited) Fail("המערכת לא עלתה בזמן", "הפרטים בקובץ smarthome.log.");
        }

        // ---------- Helpers ----------

        private void RunStep(string node, string args, string dir, string failure)
        {
            Log("> node " + args + "  (" + dir + ")");
            var info = new ProcessStartInfo(node, args)
            {
                WorkingDirectory = dir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
            };
            PrepareEnvironment(info, node);
            using (var p = new Process { StartInfo = info })
            {
                p.OutputDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
                p.ErrorDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
                p.Start();
                p.BeginOutputReadLine();
                p.BeginErrorReadLine();
                p.WaitForExit();
                if (p.ExitCode != 0) throw new StepFailed(failure, "בדקו את החיבור לאינטרנט ונסו שוב. הפרטים בקובץ smarthome.log.");
            }
        }

        /** Scripts that npm runs look for node next to it. Output goes to a plain log file, so no colors. */
        private static void PrepareEnvironment(ProcessStartInfo info, string node)
        {
            info.EnvironmentVariables["PATH"] = Path.GetDirectoryName(node) + ";" + Environment.GetEnvironmentVariable("PATH");
            info.EnvironmentVariables["NO_COLOR"] = "1";
            info.EnvironmentVariables["FORCE_COLOR"] = "0";
        }

        private static bool IsRunning()
        {
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(HealthUrl);
                request.Timeout = 1500;
                request.Proxy = null;
                using (var response = (HttpWebResponse)request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream()))
                {
                    return response.StatusCode == HttpStatusCode.OK && reader.ReadToEnd().Contains("\"ok\"");
                }
            }
            catch { return false; }
        }

        // --no-browser: for automated checks of the launcher
        private static readonly bool NoBrowser = Environment.GetCommandLineArgs().Contains("--no-browser");

        private static void OpenBrowser()
        {
            if (NoBrowser) return;
            try { Process.Start(new ProcessStartInfo(AppUrl) { UseShellExecute = true }); } catch { }
        }

        private void SetStatus(string text, string more)
        {
            Log("== " + text);
            Ui(delegate
            {
                status.ForeColor = Color.FromArgb(20, 110, 80);
                status.Text = text;
                detail.Text = more;
            });
        }

        private void Fail(string text, string more)
        {
            Ui(delegate
            {
                status.ForeColor = Color.Firebrick;
                status.Text = text;
                detail.Text = more;
                openButton.Enabled = false;
                logButton.Visible = File.Exists(LogPath);
                stopButton.Text = "סגירה";
            });
        }

        private void Ui(MethodInvoker action)
        {
            if (IsDisposed) return;
            try
            {
                if (InvokeRequired) BeginInvoke(action);
                else action();
            }
            catch (InvalidOperationException) { }
        }

        // Terminal color and cursor codes; some tools print them even when asked not to
        private static readonly Regex AnsiCodes = new Regex(@"\x1B\[[0-9;?]*[A-Za-z]", RegexOptions.Compiled);

        private readonly object logLock = new object();
        private void Log(string line)
        {
            line = AnsiCodes.Replace(line, "");
            lock (logLock)
            {
                if (log != null) log.WriteLine(line);
            }
        }

        private static string Quote(string value) { return "\"" + value + "\""; }

        private static string Hash(byte[] data)
        {
            using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(data)).Replace("-", "");
        }

        private static string RandomHex(int bytes)
        {
            var data = new byte[bytes];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(data);
            return BitConverter.ToString(data).Replace("-", "").ToLowerInvariant();
        }

        // ---------- Closing: the server closes the database itself, then exits ----------

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            closing = true;
            if (server != null && !server.HasExited)
            {
                status.Text = "סוגרים את המערכת";
                detail.Text = "שומרים את הנתונים. רק כמה שניות.";
                Refresh();
                try { server.StandardInput.Close(); } catch { }
                if (!server.WaitForExit(15000))
                {
                    try
                    {
                        var kill = new ProcessStartInfo("taskkill", "/T /F /PID " + server.Id) { CreateNoWindow = true, UseShellExecute = false };
                        using (var p = Process.Start(kill)) p.WaitForExit(5000);
                    }
                    catch { }
                }
            }
            lock (logLock)
            {
                if (log != null) log.Dispose();
                log = null;
            }
            base.OnFormClosing(e);
        }
    }

    internal sealed class StepFailed : Exception
    {
        public readonly string Detail;
        public StepFailed(string message, string detail) : base(message) { Detail = detail; }
    }
}
