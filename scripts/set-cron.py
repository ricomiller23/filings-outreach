import pexpect
import sys

secret = "my_secure_cron_secret_123"
child = pexpect.spawn('vercel env add CRON_SECRET production')
child.expect("What's the value of CRON_SECRET")
child.sendline(secret)
child.expect(r"Mark as sensitive\? \(y/N\)")
child.sendline("y")
child.expect(pexpect.EOF, timeout=10)
print(child.before.decode())
