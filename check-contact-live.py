from pathlib import Path
import sys, subprocess, time, urllib.request, json, base64
root = Path(__file__).parent
sys.path.insert(0, str(root / '.video-tools'))
import websocket

exe = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
process = subprocess.Popen([exe, '--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=9337', '--remote-allow-origins=http://localhost:9337',
    '--user-data-dir=C:/Website/.edge-qa-live', 'about:blank'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(100):
        try:
            targets = json.load(urllib.request.urlopen('http://localhost:9337/json',timeout=1))
            target = next(t for t in targets if t['type']=='page')
            break
        except Exception: time.sleep(.1)
    ws = websocket.create_connection(target['webSocketDebuggerUrl'], origin='http://localhost:9337',timeout=25)
    seq = 0
    def call(method, params=None):
        global seq
        seq += 1
        ws.send(json.dumps({'id':seq, 'method':method, 'params':params or {}}))
        while True:
            result=json.loads(ws.recv())
            if result.get('id')==seq:
                if 'error' in result: raise RuntimeError(result['error'])
                return result.get('result',{})
    def evaluate(expression):
        result=call('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True})
        if 'exceptionDetails' in result: raise RuntimeError(result['exceptionDetails'])
        return result.get('result',{}).get('value')
    call('Page.enable'); call('Runtime.enable')
    call('Page.navigate',{'url':(root/'.contact-qa.html').as_uri()})
    for _ in range(120):
        if evaluate("typeof buildWhatsAppRequest==='function'"): break
        time.sleep(.1)
    evaluate("skipIntro();document.getElementById('contact').scrollIntoView({behavior:'instant',block:'start'})")
    report=evaluate(r"""(()=>{const f=document.querySelector('.contact-form');const emptyBlocked=!f.checkValidity();const values={name:'Test Visitor',venue:'Gym & Gaming Zone',email:'test@example.com',phone:'+8801500000000',message:'Demo request & pricing?\nPlease include all details.'};for(const [k,v]of Object.entries(values))f.elements[k].value=v;const u=new URL(buildWhatsAppRequest(f));const text=u.searchParams.get('text');return {emptyBlocked,valid:f.checkValidity(),correctRecipient:u.hostname==='wa.me'&&u.pathname==='/8801533580699',allFields:Object.values(values).every(v=>text.includes(v)),email:document.querySelector('[href^="mailto:"]').getAttribute('href'),phones:[...document.querySelectorAll('.contact-info [href^="tel:"]')].map(a=>a.getAttribute('href')),mapQuery:new URL(document.querySelector('.contact-location').href).searchParams.get('query'),noFakeSuccess:!document.body.innerText.includes('Request Sent!')};})()""")
    assert report['emptyBlocked'] and report['valid'] and report['correctRecipient'] and report['allFields'] and report['noFakeSuccess'],report
    assert report['email']=='mailto:tech53171@gmail.com'
    assert report['phones']==['tel:+8801533580699','tel:+8801347351621']
    assert 'Banani' in report['mapQuery'] and 'Level 8' in report['mapQuery']
    print(json.dumps(report),flush=True)
    for width,height in [(1440,1100),(390,844)]:
        call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<600})
        evaluate("document.getElementById('contact').scrollIntoView({behavior:'instant',block:'start'})")
        time.sleep(.8)
        assert evaluate("document.documentElement.scrollWidth<=innerWidth+1")
        shot=call('Page.captureScreenshot',{'format':'png'})
        (root/('contact-'+str(width)+'.png')).write_bytes(base64.b64decode(shot['data']))
    print('Desktop/mobile contact layout fits. WhatsApp message verified locally; no request sent.',flush=True)
    ws.close()
finally:
    process.terminate()
