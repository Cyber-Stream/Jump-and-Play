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
    call('Page.navigate',{'url':(root / '.gallery-qa.html').as_uri()})
    for _ in range(150):
        if evaluate("document.querySelector('#qa-results')?.textContent || ''"): break
        time.sleep(.1)
    print('Desktop interactions:',evaluate("document.querySelector('#qa-results')?.textContent || 'Not completed'"),flush=True)
    call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1100,'deviceScaleFactor':1,'mobile':False})
    initial=evaluate("carouselRing.style.transform")
    time.sleep(1)
    later=evaluate("carouselRing.style.transform")
    print('Carousel auto-rotates:', initial != later, flush=True)
    evaluate("carouselPause.click();")
    print('Pause button:',evaluate("carouselPaused"),flush=True)
    angle=evaluate("carouselTarget")
    evaluate("techGallery.querySelector('.carousel-next').click()")
    print('Next image changes angle:',angle != evaluate("carouselTarget"),flush=True)
    shot=call('Page.captureScreenshot',{'format':'png'})
    (root/'gallery-desktop.png').write_bytes(base64.b64decode(shot['data']))
    call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    time.sleep(.5)
    print('Mobile:',evaluate("JSON.stringify({dialogFits:techGallery.getBoundingClientRect().width<=innerWidth, noHorizontalOverflow:techGallery.scrollWidth<=techGallery.clientWidth+1, columns:getComputedStyle(document.querySelector('.carousel-ring')).transform})"),flush=True)
    shot=call('Page.captureScreenshot',{'format':'png'})
    (root/'gallery-mobile.png').write_bytes(base64.b64decode(shot['data']))
    evaluate("techGallery.close(); document.querySelector('.action-card').scrollIntoView({behavior:'instant',block:'center'});")
    time.sleep(.4)
    print('Normal caption animation:',evaluate("JSON.stringify({name:getComputedStyle(document.querySelector('.action-word')).animationName, visible:document.querySelector('.action-card').classList.contains('copy-visible')})"),flush=True)
    evaluate("galleryOpen.click();")
    call('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
    print('Reduced motion:',evaluate("JSON.stringify({matches:matchMedia('(prefers-reduced-motion:reduce)').matches, animationDuration:getComputedStyle(techGallery.querySelector('figure')).animationDuration})"),flush=True)
    evaluate("techGallery.close(); document.querySelector('.action-card').classList.add('copy-visible'); document.querySelector('.action-card').scrollIntoView({behavior:'instant'});")
    time.sleep(.5)
    print('Action captions:',evaluate("JSON.stringify({wordCount:document.querySelectorAll('.action-word').length, readable:getComputedStyle(document.querySelector('.action-word')).opacity})"),flush=True)
    call('Emulation.setEmulatedMedia',{'features':[]})
    call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1100,'deviceScaleFactor':1,'mobile':False})
    evaluate("document.querySelector('#techGalleryOpen').scrollIntoView({behavior:'instant',block:'center'});")
    time.sleep(1)
    shot=call('Page.captureScreenshot',{'format':'png'})
    (root/'tech-stack-desktop.png').write_bytes(base64.b64decode(shot['data']))
    ws.close()
finally:
    process.terminate()
