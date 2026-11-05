const { execSync } = require('child_process');

function runGrep(pattern, flags = '-E', path = 'src/') {
  try {
    const cmd = `git grep ${flags} "${pattern}" -- ${path}`;
    const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const lines = output.trim().split('\n').filter(Boolean);
    return { count: lines.length, sample: lines.slice(0, 5) };
  } catch (e) {
    return { count: 0, sample: [] };
  }
}

const patterns = {
  // 1. Type Safety
  as_any: { pattern: 'as any', path: 'src/' },
  colon_any: { pattern: ': any', path: 'src/' },
  ts_ignore: { pattern: '@ts-ignore', path: 'src/' },
  ts_expect_error: { pattern: '@ts-expect-error', path: 'src/' },
  ts_nocheck: { pattern: '@ts-nocheck', path: 'src/' },
  non_null_assertion: { pattern: '![.]', path: 'src/' },

  // 2. Technical Debt & Code Smells
  todos: { pattern: 'TODO', path: 'src/' },
  fixmes: { pattern: 'FIXME', path: 'src/' },
  hacks: { pattern: 'HACK', path: 'src/' },
  console_logs: { pattern: 'console\\.(log|debug|info)', path: 'src/' },
  console_warn: { pattern: 'console\\.warn', path: 'src/' },
  console_error: { pattern: 'console\\.error', path: 'src/' },

  // 3. Security & Safety
  dangerouslySetInnerHTML: { pattern: 'dangerouslySetInnerHTML', path: 'src/' },
  eval_or_function: { pattern: '(\\beval\\(|new Function\\()', path: 'src/' },
  native_confirm: { pattern: '(window\\.|^|\\s)confirm\\(', path: 'src/' },
  native_alert: { pattern: '(window\\.|^|\\s)alert\\(', path: 'src/' },
  native_prompt: { pattern: '(window\\.|^|\\s)prompt\\(', path: 'src/' },
  window_location_reload: { pattern: 'window\\.location\\.reload', path: 'src/' },
  hardcoded_api_keys: { pattern: 'AIza[0-9A-Za-z-_]{35}', path: 'src/' },

  // 4. Persistence & Storage Access
  raw_localstorage: { pattern: 'localStorage\\.', path: 'src/' },
  raw_sessionstorage: { pattern: 'sessionStorage\\.', path: 'src/' },
  raw_indexeddb: { pattern: 'indexedDB\\.', path: 'src/' },

  // 5. Direct DB bypass in UI
  direct_firebase_in_components: { pattern: 'from [\'"].*firebase/(database|firestore)[\'"]', path: 'src/components/' },
  direct_firebase_in_pages: { pattern: 'from [\'"].*firebase/(database|firestore)[\'"]', path: 'src/pages/' },
  direct_repo_in_pages: { pattern: 'from [\'"].*(FirebaseBatchRepository|FirebaseTCCSRepository|FirebaseTestResultRepository)[\'"]', path: 'src/pages/' },

  // 6. Timers & Resource Cleanup (Leak potential)
  add_event_listener: { pattern: 'addEventListener', path: 'src/' },
  remove_event_listener: { pattern: 'removeEventListener', path: 'src/' },
  set_interval: { pattern: 'setInterval', path: 'src/' },
  clear_interval: { pattern: 'clearInterval', path: 'src/' },
  set_timeout: { pattern: 'setTimeout', path: 'src/' },
  clear_timeout: { pattern: 'clearTimeout', path: 'src/' },

  // 7. GxP / ALCOA+ Invariants
  bypass_flags: { pattern: '(adminOverride|isBypass|skipValidation|ignoreLock)', path: 'src/' },
  hash_functions: { pattern: '(sha256|SHA-256|createHash|digest)', path: 'src/' },
  signature_verifications: { pattern: '(verifySignature|validateSignature|signToken)', path: 'src/' },
};

const results = {};
for (const [key, conf] of Object.entries(patterns)) {
  results[key] = runGrep(conf.pattern, '-E', conf.path);
}

console.log(JSON.stringify(results, null, 2));

