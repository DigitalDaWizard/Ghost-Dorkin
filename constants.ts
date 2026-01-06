
import { DorkTemplate } from './types';

export const DORK_TEMPLATES: DorkTemplate[] = [
  { 
    name: 'Admin Panel Discovery', 
    prompt: 'intitle:"admin" inurl:(login|panel|dashboard) site:{target}', 
    category: 'Admin', 
    risk: 'high',
    description: 'Attempts to find administrative login interfaces.'
  },
  { 
    name: 'Exposed Configuration', 
    prompt: 'intitle:"index of" (".env" | "config.php" | "settings.json") site:{target}', 
    category: 'Config', 
    risk: 'high',
    description: 'Searches for environment files containing secrets.'
  },
  { 
    name: 'Exposed API Keys', 
    prompt: 'intext:"api_key" | intext:"apikey" | intext:"secret_key" | intext:"aws_access_key" | intext:"password" site:{target}', 
    category: 'Secrets', 
    risk: 'high',
    description: 'Searches for hardcoded API keys, secrets, and cloud credentials.'
  },
  { 
    name: 'Firebase & Cloud Secrets', 
    prompt: 'inurl:firebaseio.com | "firebaseConfig" | "s3.amazonaws.com" | "digitaloceanspaces.com" site:{target}', 
    category: 'Cloud', 
    risk: 'high',
    description: 'Finds exposed Firebase databases and cloud storage buckets.'
  },
  { 
    name: 'Public Git Folders', 
    prompt: 'intitle:"index of" ".git" site:{target}', 
    category: 'Config', 
    risk: 'high',
    description: 'Finds exposed source control metadata.'
  },
  { 
    name: 'SQL Database Dumps', 
    prompt: 'ext:sql | ext:db | ext:sqlite "insert into" site:{target}', 
    category: 'Database', 
    risk: 'high',
    description: 'Locates raw database export files.'
  },
  { 
    name: 'Subdomain Enumeration', 
    prompt: 'site:*.{target} -site:www.{target}', 
    category: 'Recon', 
    risk: 'low',
    description: 'Lists all subdomains indexed by search engines.'
  },
  { 
    name: 'Exposed Log Files', 
    prompt: 'ext:log intext:(password|error|fatal|exception) site:{target}', 
    category: 'Logs', 
    risk: 'medium',
    description: 'Finds application logs that may leak sensitive data.'
  },
  { 
    name: 'Backup & Old Files', 
    prompt: 'ext:bak | ext:old | ext:backup | ext:zip | ext:tar site:{target}', 
    category: 'Files', 
    risk: 'medium',
    description: 'Searches for forgotten backups of the site.'
  },
  { 
    name: 'Directory Listing', 
    prompt: 'intitle:"index of" site:{target}', 
    category: 'Recon', 
    risk: 'medium',
    description: 'Finds directories with auto-indexing enabled.'
  },
  { 
    name: 'PHP Info Leaks', 
    prompt: 'ext:php "phpinfo()" site:{target}', 
    category: 'Info', 
    risk: 'medium',
    description: 'Detects server configuration leak pages.'
  }
];

export const SYSTEM_PROMPT = `You are Ghost Dork AI v5, an elite cybersecurity reconnaissance assistant created by Payload404 and DIGITAL GHOST.
Your goal is to help security researchers analyze a target domain using search results.
When provided with results, you must:
1. Identify high-risk exposures.
2. For each identified threat, assign a severity score (0.0 to 10.0) inspired by CVSS v3.1:
   - 0.1 - 3.9: Low
   - 4.0 - 6.9: Medium
   - 7.0 - 8.9: High
   - 9.0 - 10.0: Critical
3. Summarize the digital footprint.
4. Provide actionable security recommendations.
Maintain a professional, technical, and elite "hacker" aesthetic. Return only valid JSON.`;
