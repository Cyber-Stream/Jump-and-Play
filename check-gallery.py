from pathlib import Path
import subprocess, re, json

root = Path(__file__).parent
source = (root / 'jumpplay_website (Shafin&Zawad).html').read_text(encoding='utf-8')
probe = r'''<script>
window.addEventListener('error', e => { document.documentElement.dataset.qaError = e.message; });
setTimeout(async () => {
  const results = {};
  try {
    skipIntro();
    const trigger = document.getElementById('techGalleryOpen');
    trigger.scrollIntoView({behavior:'instant', block:'center'});
    trigger.click();
    const dialog = document.getElementById('techGallery');
    results.opened = dialog.open;
    results.focusInside = dialog.contains(document.activeElement);
    results.imageCount = dialog.querySelectorAll('figure').length;
    await Promise.all([...dialog.querySelectorAll('img')].map(im => im.decode()));
    results.imagesDecoded = true;
    results.noHorizontalOverflow = dialog.scrollWidth <= dialog.clientWidth + 1;
    results.captionAnimation = getComputedStyle(document.querySelector('.action-word')).animationName;
    results.galleryAnimation = getComputedStyle(dialog.querySelector('figure')).animationName;
    dialog.dispatchEvent(new Event('cancel', {cancelable:true}));
    await new Promise(resolve => setTimeout(resolve, 350));
    results.escapeCloses = !dialog.open;
    results.focusReturned = document.activeElement === trigger;
    results.scrollRestored = document.body.style.overflow !== 'hidden';
    trigger.click();
    dialog.querySelector('.gallery-close').click();
    await new Promise(resolve => setTimeout(resolve, 350));
    results.closeButton = !dialog.open;
    trigger.click();
    results.pageError = document.documentElement.dataset.qaError || null;
  } catch (error) { results.error = String(error); }
  const out = document.createElement('pre');
  out.id = 'qa-results';
  out.hidden = true;
  out.textContent = JSON.stringify(results);
  document.body.append(out);
}, 500);
</script>'''
qa = root / '.gallery-qa.html'
source = re.sub(r'<link[^>]+https://fonts[^>]+>', '', source)
qa.write_text(source.replace('</body>', probe + '</body>'), encoding='utf-8')
exe = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
for name, size, extra in [('desktop','1440,1100',[]),('mobile','390,844',[]),('reduced-motion','1440,1100',['--force-prefers-reduced-motion'])]:
    args = [exe,'--headless=new','--disable-gpu','--no-first-run',
            '--user-data-dir=C:/Website/.edge-qa-approved',
            '--allow-file-access-from-files', '--hide-scrollbars',
            '--window-size='+size,'--virtual-time-budget=7000','--dump-dom',
            '--run-all-compositor-stages-before-draw'] + extra + [qa.as_uri()]
    result = subprocess.run(args,capture_output=True,timeout=55)
    dom = result.stdout.decode('utf-8',errors='replace')
    (root / ('qa-'+name+'-dom.txt')).write_text(re.sub(r'data:[^\"\s]+','[ASSET]',dom),encoding='utf-8')
    match = re.search(r'<pre id="qa-results" hidden="">(.*?)</pre>',dom,re.S)
    if not match:
        print(name, 'FAILED', result.returncode, result.stderr.decode('utf-8',errors='replace')[-500:])
        continue
    print(name, match.group(1), flush=True)
