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
    call('Page.enable');call('Runtime.enable')
    call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1100,'deviceScaleFactor':1,'mobile':False})
    call('Page.navigate',{'url':(root/'.how-qa.html').as_uri()})
    for _ in range(150):
        if evaluate("document.getElementById('howExperience')?.dataset.ready==='true' || document.getElementById('howExperience')?.classList.contains('experience-fallback')"):break
        time.sleep(.1)
    evaluate("skipIntro();howExperience.scrollIntoView({behavior:'instant',block:'center'})")
    time.sleep(1)
    assert evaluate("howExperience.dataset.ready==='true' && !howExperience.classList.contains('experience-fallback')")
    for i in range(6):
        evaluate("document.querySelectorAll('#howExperience .walkthrough-stage-button')["+str(i)+"].click()")
        time.sleep(.25)
        report=evaluate("JSON.stringify({stage:howExperience.dataset.stage,activeCard:[...document.querySelectorAll('.how-section .step-card')].findIndex(c=>c.classList.contains('walkthrough-active')),title:document.querySelector('#howExperience .walkthrough-title').textContent})")
        assert json.loads(report)['stage']==str(i) and json.loads(report)['activeCard']==i,report
        print('Step',i+1,report,flush=True)
        if i in [0,1,4,5]:
            shot=call('Page.captureScreenshot',{'format':'png'})
            (root/('how-step-'+str(i+1)+'.png')).write_bytes(base64.b64decode(shot['data']))
    evaluate("document.querySelectorAll('.how-section .step-card')[2].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))")
    time.sleep(.2)
    assert evaluate("howExperience.dataset.stage==='2'")
    evaluate("document.querySelector('#howExperience .experience-replay').click()")
    time.sleep(.25)
    assert evaluate("howExperience.dataset.stage==='0'")
    before=evaluate("document.querySelector('#howExperience .walkthrough-progress-fill').style.transform")
    time.sleep(.4)
    assert before!=evaluate("document.querySelector('#howExperience .walkthrough-progress-fill').style.transform")
    evaluate("document.querySelector('#howExperience .experience-pause').click()")
    assert evaluate("document.querySelector('#howExperience .experience-pause').textContent")== 'Play walkthrough'
    call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    evaluate("document.querySelectorAll('#howExperience .walkthrough-stage-button')[5].click();howExperience.scrollIntoView({behavior:'instant',block:'center'})")
    time.sleep(.8)
    assert evaluate("document.documentElement.scrollWidth<=innerWidth+1")
    shot=call('Page.captureScreenshot',{'format':'png'})
    (root/'how-mobile.png').write_bytes(base64.b64decode(shot['data']))
    call('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
    time.sleep(.2)
    assert evaluate("document.querySelector('#howExperience .experience-pause').textContent")== 'Play walkthrough'
    assert evaluate("!document.documentElement.dataset.qaError")
    print('All six stages, keyboard selection, autoplay, pause/replay, mobile sizing and reduced motion passed. No page errors.',flush=True)
    ws.close()
finally:
    process.terminate()
