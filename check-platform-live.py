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
    call('Page.navigate',{'url':(root / '.platform-qa.html').as_uri()})
    for _ in range(150):
        if evaluate("document.readyState==='complete' && typeof initImageCarousel==='function'"): break
        time.sleep(.1)
    evaluate("skipIntro()")
    time.sleep(1)
    for section in ['home','platform','games','action','gyms','tech','contact']:
        evaluate("document.getElementById('"+section+"').scrollIntoView({behavior:'instant',block:'start'})")
        time.sleep(.3)
        actual=evaluate("document.querySelector('.tracker-tabs .is-active')?.hash")
        assert actual=='#'+section,(section,actual)
        print('Section tracker:',section,'OK',flush=True)
    for gallery_id,trigger_id,count in [('platformGallery','platformGalleryOpen',4),('techGallery','techGalleryOpen',5)]:
        evaluate("document.getElementById('"+trigger_id+"').click()")
        time.sleep(.5)
        report=evaluate("""(async()=>{const d=document.getElementById('"""+gallery_id+"""');await Promise.all([...d.querySelectorAll('img')].map(i=>i.decode()));return {open:d.open,images:d.querySelectorAll('figure').length,focusInside:d.contains(document.activeElement),step:d.querySelector('.carousel-ring').style.getPropertyValue('--carousel-step')};})()""")
        assert report['images']==count and report['open'] and report['focusInside'],report
        before=evaluate("document.querySelector('#"+gallery_id+" .carousel-ring').style.transform")
        time.sleep(.5)
        after=evaluate("document.querySelector('#"+gallery_id+" .carousel-ring').style.transform")
        assert before!=after
        evaluate("document.querySelector('#"+gallery_id+" .carousel-pause').click()")
        print(gallery_id,report,'rotation and pause verified',flush=True)
        if gallery_id=='platformGallery':
            shot=call('Page.captureScreenshot',{'format':'png'})
            (root/'platform-carousel-desktop.png').write_bytes(base64.b64decode(shot['data']))
        evaluate("document.getElementById('"+gallery_id+"').dispatchEvent(new Event('cancel',{cancelable:true}))")
        time.sleep(.35)
        assert evaluate("!document.getElementById('"+gallery_id+"').open")
    call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    evaluate("document.getElementById('platform').scrollIntoView({behavior:'instant',block:'start'})")
    time.sleep(.7)
    shot=call('Page.captureScreenshot',{'format':'png'})
    (root/'platform-stack-mobile.png').write_bytes(base64.b64decode(shot['data']))
    for section in ['platform','action','tech','contact']:
        evaluate("document.getElementById('"+section+"').scrollIntoView({behavior:'instant',block:'start'})")
        time.sleep(.5)
        report=evaluate("(()=>{const a=document.querySelector('.tracker-tabs .is-active');const r=a.getBoundingClientRect();return {hash:a.hash,visible:r.left>=0&&r.right<=innerWidth,barTop:document.querySelector('.section-tracker').getBoundingClientRect().top,navBottom:document.querySelector('nav').getBoundingClientRect().bottom}})()")
        assert report['hash']=='#'+section and report['visible'],report
        assert abs(report['barTop']-report['navBottom'])<2,report
        print('Mobile tracker:',report,flush=True)
    evaluate("document.getElementById('platformGalleryOpen').click()")
    time.sleep(.8)
    shot=call('Page.captureScreenshot',{'format':'png'})
    (root/'platform-carousel-mobile.png').write_bytes(base64.b64decode(shot['data']))
    assert evaluate("document.documentElement.scrollWidth<=innerWidth+1")
    print('Mobile fits viewport; no page errors:',evaluate("document.documentElement.dataset.qaError || 'none'"),flush=True)
    ws.close()
finally:
    process.terminate()
