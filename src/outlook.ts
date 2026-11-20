import { execFile, execFileSync } from 'node:child_process';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

/**
 * Outlook on this PC, read-only. Brains can list, search and read email and see the calendar
 * through the classic Outlook app (Windows COM). No Microsoft sign-in, nothing is sent, moved or deleted.
 */

let available: boolean | null = null;
/** True when classic Outlook is installed on this Windows PC. */
export function outlookAvailable(): boolean {
  if (available !== null) return available;
  if (process.platform !== 'win32') return (available = false);
  try {
    execFileSync('reg', ['query', 'HKCR\\Outlook.Application'], { stdio: 'ignore', windowsHide: true, timeout: 10_000 });
    available = true;
  } catch {
    available = false;
  }
  return available;
}

// One PowerShell script for every action. The action and its inputs arrive as JSON in an environment
// variable, never inside the script text, so nothing the brain writes can run as a command.
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$a = $env:OUTLOOK_ARGS | ConvertFrom-Json
$ol = New-Object -ComObject Outlook.Application
$ns = $ol.GetNamespace('MAPI')
function Clean($s, $n) { if (-not $s) { return '' }; $t = ($s -replace '\s+', ' ').Trim(); if ($t.Length -gt $n) { $t.Substring(0, $n) + '...' } else { $t } }
function From($m) { $addr = $m.SenderEmailAddress; if ($addr -and $addr -notmatch '@') { try { $addr = $m.Sender.GetExchangeUser().PrimarySmtpAddress } catch { $addr = '' } }; if ($addr) { "$($m.SenderName) <$addr>" } else { $m.SenderName } }
function Row($m, $store) { [pscustomobject]@{ id = "$($m.EntryID)|$($store.StoreID)"; account = $store.DisplayName; folder = $m.Parent.Name; received = $m.ReceivedTime.ToString('yyyy-MM-dd HH:mm'); from = (From $m); subject = $m.Subject; unread = [bool]$m.UnRead; attachments = $m.Attachments.Count; preview = (Clean $m.Body 220) } }
function Inboxes { foreach ($s in $ns.Stores) { try { $f = $s.GetDefaultFolder(6); if ($f) { ,@($s, $f) } } catch {} } }
function Folders { foreach ($s in $ns.Stores) { foreach ($k in @(6, 5)) { try { $f = $s.GetDefaultFolder($k); if ($f) { ,@($s, $f) } } catch {} } } }
$since = (Get-Date).AddDays(-[int]$a.days).ToString('g')
$out = @()
switch ($a.action) {
  'list' {
    foreach ($p in Inboxes) {
      $items = $p[1].Items.Restrict("[ReceivedTime] >= '$since'")
      if ($a.unreadOnly) { $items = $items.Restrict('[UnRead] = True') }
      $items.Sort('[ReceivedTime]', $true)
      $i = 0; foreach ($m in $items) { if ($m.Class -ne 43) { continue }; $out += Row $m $p[0]; if (++$i -ge $a.limit) { break } }
    }
    $out = @($out | Sort-Object received -Descending | Select-Object -First $a.limit)
  }
  'search' {
    $q = ([string]$a.query).Replace("'", "''")
    $f = ([string]$a.from).Replace("'", "''")
    $parts = @()
    if ($q) { $parts += "(""urn:schemas:httpmail:subject"" LIKE '%$q%' OR ""urn:schemas:httpmail:textdescription"" LIKE '%$q%' OR ""urn:schemas:httpmail:fromname"" LIKE '%$q%')" }
    if ($f) { $parts += "(""urn:schemas:httpmail:fromname"" LIKE '%$f%' OR ""urn:schemas:httpmail:fromemail"" LIKE '%$f%')" }
    $dasl = if ($parts.Count) { '@SQL=' + ($parts -join ' AND ') } else { $null }
    foreach ($p in Folders) {
      $items = $p[1].Items.Restrict("[ReceivedTime] >= '$since'")
      if ($dasl) { $items = $items.Restrict($dasl) }
      $items.Sort('[ReceivedTime]', $true)
      $i = 0; foreach ($m in $items) { if ($m.Class -ne 43) { continue }; $out += Row $m $p[0]; if (++$i -ge $a.limit) { break } }
    }
    $out = @($out | Sort-Object received -Descending | Select-Object -First $a.limit)
  }
  'read' {
    $ids = ([string]$a.id).Split('|')
    $m = $ns.GetItemFromID($ids[0], $ids[1])
    $names = @(); foreach ($x in $m.Attachments) { $names += $x.FileName }
    $body = [string]$m.Body; if ($body.Length -gt 20000) { $body = $body.Substring(0, 20000) + [Environment]::NewLine + '[...cut, message is longer]' }
    $out = [pscustomobject]@{ subject = $m.Subject; from = (From $m); to = $m.To; cc = $m.CC; received = $m.ReceivedTime.ToString('yyyy-MM-dd HH:mm'); attachments = $names; body = $body }
  }
  'folders' {
    foreach ($s in $ns.Stores) {
      try { $root = $s.GetRootFolder() } catch { continue }
      foreach ($f in $root.Folders) { $out += [pscustomobject]@{ account = $s.DisplayName; folder = $f.Name; items = $f.Items.Count; unread = $f.UnReadItemCount } }
    }
  }
  'calendar' {
    $start = (Get-Date).Date; $end = $start.AddDays([int]$a.days + 1)
    foreach ($s in $ns.Stores) {
      try { $cal = $s.GetDefaultFolder(9) } catch { continue }
      $items = $cal.Items; $items.IncludeRecurrences = $true; $items.Sort('[Start]')
      $items = $items.Restrict("[Start] >= '$($start.ToString('g'))' AND [Start] < '$($end.ToString('g'))'")
      foreach ($e in $items) { $out += [pscustomobject]@{ account = $s.DisplayName; start = $e.Start.ToString('yyyy-MM-dd HH:mm'); end = $e.End.ToString('yyyy-MM-dd HH:mm'); subject = $e.Subject; location = $e.Location; organizer = $e.Organizer; attendees = (Clean $e.RequiredAttendees 300) } }
    }
    $out = @($out | Sort-Object start)
  }
}
ConvertTo-Json -InputObject $out -Depth 4 -Compress
`;

function run(args: Record<string, unknown>): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT],
      { env: { ...process.env, OUTLOOK_ARGS: JSON.stringify(args) }, windowsHide: true, timeout: 90_000, maxBuffer: 20 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) resolve(`Outlook could not answer: ${(stderr || err.message).split('\n').find((l) => l.trim()) ?? 'unknown error'}. Is classic Outlook installed and signed in?`);
        else resolve(stdout.trim() || '[]');
      },
    );
  });
}

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });

/** The read-only Outlook tools for a brain's session. */
export function outlookServer() {
  return createSdkMcpServer({
    name: 'outlook',
    tools: [
      tool('list_emails', 'List recent emails in the Outlook inbox (all accounts on this PC), newest first. Read-only.', {
        days: z.number().int().min(1).max(365).default(3).describe('How many days back'),
        limit: z.number().int().min(1).max(100).default(25),
        unreadOnly: z.boolean().default(false),
      }, async (a) => text(await run({ action: 'list', ...a }))),
      tool('search_emails', 'Search Outlook email (inbox and sent) by words in the subject, body or sender, and/or by who sent it. Read-only.', {
        query: z.string().max(200).default('').describe('Words to look for'),
        from: z.string().max(200).default('').describe('Sender name or email address'),
        days: z.number().int().min(1).max(730).default(30),
        limit: z.number().int().min(1).max(100).default(25),
      }, async (a) => text(await run({ action: 'search', ...a }))),
      tool('read_email', 'Read one email in full (body, to, cc, attachment names) by the id from list_emails or search_emails. Read-only.', {
        id: z.string().min(1).max(1000),
      }, async (a) => text(await run({ action: 'read', id: a.id }))),
      tool('list_folders', 'List the Outlook mail folders with item and unread counts. Read-only.', {}, async () => text(await run({ action: 'folders' }))),
      tool('list_calendar', 'List Outlook calendar events from today forward. Read-only.', {
        days: z.number().int().min(0).max(60).default(7).describe('How many days ahead'),
      }, async (a) => text(await run({ action: 'calendar', ...a }))),
    ],
  });
}
