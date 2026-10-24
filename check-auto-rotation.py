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
    call('Page.navigate',{'url':(root/'.auto-rotation-qa.html').as_uri()})
    for _ in range(120):
        if evaluate("typeof initImageCarousel==='function'"): break
        time.sleep(.1)
    evaluate("skipIntro()")
    for collection in ['platform','tech']:
        trigger=collection+'GalleryOpen'; dialog=collection+'Gallery'
        evaluate("document.getElementById('"+trigger+"').scrollIntoView({behavior:'instant',block:'center'})")
        time.sleep(.3)
        before=evaluate("[...document.querySelectorAll('#"+trigger+" .tech-stack-card')].map(c=>c.style.zIndex).join(',')")
        time.sleep(3.2)
        after=evaluate("[...document.querySelectorAll('#"+trigger+" .tech-stack-card')].map(c=>c.style.zIndex).join(',')")
        assert before!=after,(collection,'preview not cycling')
        evaluate("document.getElementById('"+trigger+"').click()")
        time.sleep(.2)
        before=evaluate("document.querySelector('#"+dialog+" .carousel-ring').style.transform")
        time.sleep(.4)
        after=evaluate("document.querySelector('#"+dialog+" .carousel-ring').style.transform")
        assert before!=after,(collection,'not rotating')
        evaluate("document.querySelector('#"+dialog+" .carousel-pause').click();document.getElementById('"+dialog+"').close();document.getElementById('"+trigger+"').click()")
        assert evaluate("document.querySelector('#"+dialog+" .carousel-pause').textContent")== 'Pause rotation'
        evaluate("document.getElementById('"+dialog+"').close()")
        print(collection+': preview cycles, carousel rotates automatically, reopening resets pause state.',flush=True)
    ws.close()
finally:
    process.terminate()
