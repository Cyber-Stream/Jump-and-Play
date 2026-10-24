from pathlib import Path
import sys, subprocess, time, urllib.request, json, tempfile, uuid, os
from urllib.parse import urlparse, parse_qs
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / '.video-tools'))
import websocket

url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
port = 9348
email = 'browser-test-' + str(uuid.uuid4()) + '@example.invalid'
profile = tempfile.TemporaryDirectory(prefix='jumpplay-browser-')
process = subprocess.Popen([
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    f'--remote-debugging-port={port}', f'--remote-allow-origins=http://localhost:{port}',
    '--user-data-dir=' + profile.name, 'about:blank'
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ws = None
try:
    for _ in range(120):
        try:
            targets = json.load(urllib.request.urlopen(f'http://localhost:{port}/json', timeout=1))
            target = next(t for t in targets if t['type'] == 'page')
            break
        except Exception:
            time.sleep(.2)
    else: raise RuntimeError('Chrome debug endpoint unavailable')
    ws = websocket.create_connection(target['webSocketDebuggerUrl'], origin=f'http://localhost:{port}', timeout=30)
    seq = 0
    def call(method, params=None):
        global seq
        seq += 1
        ws.send(json.dumps({'id': seq, 'method': method, 'params': params or {}}))
        while True:
            result = json.loads(ws.recv())
            if result.get('id') == seq:
                if 'error' in result: raise RuntimeError(result['error'])
                return result.get('result', {})
    def evaluate(expression):
        result = call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
        if 'exceptionDetails' in result: raise RuntimeError(result['exceptionDetails'])
        return result.get('result', {}).get('value')
    call('Page.enable')
    call('Page.navigate', {'url': url})
    for _ in range(150):
        if evaluate("typeof window.submitEnquiry === 'function'"): break
        time.sleep(.2)
    else: raise RuntimeError('Backend form script did not load')
    values = {'name': "Test O'Connor", 'venue': 'Gym & Gaming + Dhaka #1', 'email': email, 'phone': '+880 1500000000', 'message': 'ঢাকায় ডেমো চাই 🎮 & ১০০% + #?=\nSecond line: café / pricing? Automated test; will be removed.'}
    evaluate("""(() => {
      const original = window.fetch;
      window.testKeys = [];
      window.fetch = (url, options) => {
        if (url === '/api/enquiries') {
          window.testKeys.push(options.headers['Idempotency-Key']);
          if (window.testKeys.length === 1) return Promise.reject(new TypeError('Simulated offline'));
        }
        return original(url, options);
      };
    })()""")
    evaluate('''(() => { const form = document.querySelector('.contact-form');
      const values = ''' + json.dumps(values) + ''';
      for (const [key, value] of Object.entries(values)) form.elements[key].value = value;
      form.requestSubmit(); })()''')
    for _ in range(120):
        if evaluate("document.querySelector('[role=status]').textContent.includes('could not confirm')"): break
        time.sleep(.2)
    else: raise RuntimeError('Network failure did not show a retry message')
    assert evaluate("document.querySelector('#contact-email').value") == email
    assert evaluate("[...document.querySelector('.contact-form').querySelectorAll('a')].some(a => a.textContent === 'Continue on WhatsApp' && !a.hidden)"), 'WhatsApp fallback missing after network failure'
    evaluate("document.querySelector('.contact-form').requestSubmit()")
    for _ in range(150):
        text = evaluate("document.querySelector('[role=status]').textContent")
        if 'Your request is saved.' in text: break
        time.sleep(.2)
    else: raise RuntimeError('Submission failed: ' + str(text))
    report = evaluate("""(() => {
      const form = document.querySelector('.contact-form');
      const link = [...form.querySelectorAll('a')].find(a => a.textContent === 'Continue on WhatsApp');
      return { sameRetryKey: window.testKeys[0] === window.testKeys[1],
        reset: form.elements.email.value === '', buttonEnabled: !form.querySelector('button').disabled,
        whatsappVisible: !link.hidden && new URL(link.href).hostname === 'wa.me',
        stayedOnSite: location.host === new URL('""" + url + """').host };
    })()""")
    assert all(report.values()), report
    whatsapp = evaluate("""(() => {
      const form = document.querySelector('.contact-form');
      const link = [...form.querySelectorAll('a')].find(a => a.textContent === 'Continue on WhatsApp');
      const url = new URL(link.href);
      const status = form.querySelector('[role=status]').textContent;
      return { number: url.pathname, text: url.searchParams.get('text'),
        parameterCount: [...url.searchParams.keys()].length,
        reference: status.match(/Reference: ([0-9a-f-]+)/)[1],
        noReferrer: link.referrerPolicy === 'no-referrer',
        sendInstruction: [...form.querySelectorAll('p')].some(p => !p.hidden && p.textContent.includes('Tap Send in WhatsApp')) };
    })()""")
    assert whatsapp['number'] == '/8801533580699'
    assert whatsapp['parameterCount'] == 1 and whatsapp['noReferrer'] and whatsapp['sendInstruction']
    assert all(value in whatsapp['text'] for value in values.values()), 'WhatsApp message lost form fields or Unicode'
    assert ('Request reference: ' + whatsapp['reference']) in whatsapp['text']
    for width, height in [(1440, 1000), (390, 844)]:
        call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': width < 600})
        assert evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Layout overflow'
    # Open the prefilled chat only. Never click Send or send a real WhatsApp message.
    call('Runtime.evaluate', {'expression': "[...document.querySelector('.contact-form').querySelectorAll('a')].find(a => a.textContent === 'Continue on WhatsApp').click()", 'userGesture': True})
    opened = False
    for _ in range(60):
        targets = call('Target.getTargets').get('targetInfos', [])
        for target in targets:
            destination = urlparse(target.get('url', ''))
            query = parse_qs(destination.query)
            if destination.hostname in ['wa.me', 'api.whatsapp.com', 'web.whatsapp.com']:
                number = destination.path.strip('/') if destination.hostname == 'wa.me' else query.get('phone', [''])[0]
                if number == '8801533580699' and query.get('text', [''])[0] == whatsapp['text']:
                    opened = True
        if opened: break
        time.sleep(.2)
    assert opened, 'Click did not open the correct prefilled WhatsApp destination'
    copySelector = "[...document.querySelector('.contact-form').querySelectorAll('button')].find(b => b.textContent === 'Copy WhatsApp message')"
    evaluate("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedWhatsAppMessage = text; } } });")
    evaluate(copySelector + '.click()')
    assert evaluate('window.copiedWhatsAppMessage') == whatsapp['text']
    evaluate("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard blocked'); } } });")
    evaluate(copySelector + '.click()')
    for _ in range(30):
        if evaluate("!document.querySelector('textarea[aria-label]').hidden"): break
        time.sleep(.1)
    assert evaluate("document.querySelector('textarea[aria-label]').value") == whatsapp['text']
    # A provider outage may return HTML rather than JSON; WhatsApp remains usable.
    evaluate("window.fetch = async () => new Response('<h1>Unavailable</h1>', { status: 503 });")
    evaluate('''(() => { const form = document.querySelector('.contact-form');
      const values = ''' + json.dumps(values) + ''';
      for (const [key, value] of Object.entries(values)) form.elements[key].value = value;
      form.requestSubmit(); })()''')
    for _ in range(50):
        if evaluate("document.querySelector('[role=status]').textContent.includes('server could not confirm')"): break
        time.sleep(.1)
    fallback = evaluate("""(() => {
      const link = [...document.querySelector('.contact-form').querySelectorAll('a')].find(a => a.textContent === 'Continue on WhatsApp');
      return { shown: !link.hidden, text: new URL(link.href).searchParams.get('text'), message: document.querySelector('[role=status]').textContent };
    })()""")
    assert fallback['shown'] and all(v in fallback['text'] for v in values.values())
    assert 'Your request is saved.' not in fallback['message'] and 'Request reference:' not in fallback['text']
    print(json.dumps({'browser': 'passed', 'networkRetry': report, 'responsive': True, 'whatsappRecipient': whatsapp['number'], 'messageFieldsAndUnicode': True, 'referenceIncluded': True, 'explicitSendInstruction': True, 'whatsappTabOpened': True, 'clipboardAndManualCopy': True, 'serverOutageFallback': True, 'messageSent': False}), flush=True)
finally:
    if ws: ws.close()
    process.terminate()
    try: process.wait(timeout=10)
    except subprocess.TimeoutExpired: process.kill()
    # Remove only this test's records, never visitor enquiries.
    env = os.environ.copy()
    env['BROWSER_TEST_EMAIL'] = email
    cleanup = "const {database}=require('./lib/database.cjs'); const s=database(); s`DELETE FROM enquiries WHERE email=${process.env.BROWSER_TEST_EMAIL}`.then(()=>console.log('Browser test record removed')).catch(()=>process.exitCode=1);"
    result = subprocess.run(['C:/Program Files/nodejs/node.exe', '--env-file=.env.local', '-e', cleanup], cwd=root, env=env, capture_output=True, text=True)
    print(result.stdout.strip(), flush=True)
    if result.returncode: raise RuntimeError('Browser test record cleanup failed')
    try: profile.cleanup()
    except PermissionError: pass
