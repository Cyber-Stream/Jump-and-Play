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
    call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1100,'deviceScaleFactor':1,'mobile':False})
    call('Page.navigate',{'url':(root / '.experience-qa.html').as_uri()})
    for _ in range(150):
        if evaluate("document.querySelector('#jumpExperience')?.dataset.ready==='true' || document.querySelector('#jumpExperience')?.classList.contains('experience-fallback')"): break
        time.sleep(.1)
    evaluate("skipIntro(); document.getElementById('jumpExperience').scrollIntoView({behavior:'instant',block:'center'})")
    time.sleep(1.5)
    print('Scene status:',evaluate("JSON.stringify({ready:jumpExperience.dataset.ready,fallback:jumpExperience.classList.contains('experience-fallback'),canvas:!!jumpExperience.querySelector('canvas'),error:document.documentElement.dataset.qaError||null,phase:jumpExperience.dataset.phase})"),flush=True)
    for _ in range(5):
        print('Animation:',evaluate("document.querySelector('.experience-status').textContent"),flush=True)
        time.sleep(.65)
    evaluate("document.querySelector('.experience-pause').click()")
    time.sleep(.3)
    print('Pause:',evaluate("document.querySelector('.experience-pause').textContent"),flush=True)
    shot=call('Page.captureScreenshot',{'format':'png'})
    (root/'experience-desktop.png').write_bytes(base64.b64decode(shot['data']))
    evaluate("document.querySelector('.experience-replay').click()")
    print('Replay:',evaluate("document.querySelector('.experience-pause').textContent"),flush=True)
    call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    evaluate("jumpExperience.scrollIntoView({behavior:'instant',block:'center'})")
    time.sleep(1)
    shot=call('Page.captureScreenshot',{'format':'png'})
    (root/'experience-mobile.png').write_bytes(base64.b64decode(shot['data']))
    print('Mobile:',evaluate("JSON.stringify({fits:document.documentElement.scrollWidth<=innerWidth+1,canvasWidth:jumpExperience.querySelector('canvas')?.clientWidth,viewportWidth:document.querySelector('.experience-viewport').clientWidth})"),flush=True)
    call('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
    time.sleep(.2)
    print('Reduced motion:',evaluate("document.querySelector('.experience-pause').textContent"),flush=True)
    print('Final page errors:',evaluate("document.documentElement.dataset.qaError||'none'"),flush=True)
    ws.close()
finally:
    process.terminate()
