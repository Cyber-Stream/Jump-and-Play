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
    call('Page.enable')
    call('Runtime.enable')
    call('Page.navigate',{'url':(root / '.navigation-qa.html').as_uri()})
    for _ in range(100):
        if evaluate("typeof updateSectionNavigation==='function'"): break
        time.sleep(.1)
    evaluate("skipIntro()")
    for width,height in [(1440,1000),(390,844)]:
        call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<600})
        for section in ['platform','games','action','gyms','tech','contact']:
            evaluate("document.getElementById('"+section+"').scrollIntoView({behavior:'instant',block:'start'})")
            time.sleep(.5)
            report=evaluate("(()=>{const a=document.querySelector('.nav-links .is-active');const n=document.querySelector('.nav-links');const i=document.querySelector('.nav-indicator');return {active:a?.hash,underline:parseFloat(i.style.width)>0,visible:a.getBoundingClientRect().left>=n.getBoundingClientRect().left-1&&a.getBoundingClientRect().right<=n.getBoundingClientRect().right+1,duplicate:!!document.querySelector('.section-tracker')}})()")
            assert report['active']=='#'+section and report['underline'] and report['visible'] and not report['duplicate'],report
        print(str(width)+'px: all six original navigation links track scroll, underline aligns, active link visible, no duplicate bar.',flush=True)
        shot=call('Page.captureScreenshot',{'format':'png'})
        (root/('single-nav-'+str(width)+'.png')).write_bytes(base64.b64decode(shot['data']))
    ws.close()
finally:
    process.terminate()
