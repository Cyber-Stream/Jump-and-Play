(() => {
  'use strict';
  const form = document.querySelector('.contact-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'margin-top:1rem;line-height:1.6;overflow-wrap:anywhere';
  form.append(status);
  const whatsapp = document.createElement('a');
  whatsapp.textContent = 'Continue on WhatsApp';
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener noreferrer';
  whatsapp.referrerPolicy = 'no-referrer';
  whatsapp.hidden = true;
  whatsapp.style.cssText = 'display:none;align-items:center;min-height:44px;margin-top:.75rem;color:inherit;text-decoration:underline';
  form.append(whatsapp);
  const instructions = document.createElement('p');
  instructions.textContent = 'WhatsApp opens with your details filled in. Tap Send in WhatsApp to deliver the message.';
  instructions.style.cssText = 'margin-top:.5rem;line-height:1.6';
  instructions.hidden = true;
  form.append(instructions);
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy WhatsApp message';
  copy.hidden = true;
  copy.style.cssText = 'display:none;min-height:44px;margin-top:.5rem;padding:.5rem .75rem;background:transparent;color:inherit;border:1px solid currentColor;border-radius:6px;font:inherit;cursor:pointer';
  form.append(copy);
  const copyStatus = document.createElement('p');
  copyStatus.setAttribute('role', 'status');
  form.append(copyStatus);
  const manualCopy = document.createElement('textarea');
  manualCopy.readOnly = true;
  manualCopy.hidden = true;
  manualCopy.setAttribute('aria-label', 'WhatsApp message to copy');
  manualCopy.style.cssText = 'width:100%;min-height:160px;margin-top:.5rem;font:inherit';
  form.append(manualCopy);
  let messageToCopy = '';
  copy.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(messageToCopy);
      copyStatus.textContent = 'Message copied. If the chat did not prefill, paste it into WhatsApp and tap Send.';
    } catch {
      manualCopy.value = messageToCopy;
      manualCopy.hidden = false;
      manualCopy.focus();
      manualCopy.select();
      copyStatus.textContent = 'Select and copy the message below, then paste it into WhatsApp and tap Send.';
    }
  });
  const showWhatsApp = href => {
    whatsapp.href = href;
    whatsapp.hidden = false;
    whatsapp.style.display = 'inline-flex';
    instructions.hidden = false;
    messageToCopy = new URL(href).searchParams.get('text') || '';
    copy.hidden = false;
    copy.style.display = 'inline-block';
  };
  let pending = false, lastPayload = '', key;
  window.submitEnquiry = async event => {
    event.preventDefault();
    if (pending) return;
    for (const field of form.elements) {
      if (field.required && typeof field.value === 'string') field.setCustomValidity(field.value.trim() ? '' : 'Please fill out this field.');
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = Object.fromEntries(['name', 'venue', 'email', 'phone', 'message', 'website'].map(name => [name, String(data.get(name) || '').trim()]));
    const serialized = JSON.stringify(payload);
    if (!key || serialized !== lastPayload) { key = crypto.randomUUID(); lastPayload = serialized; }
    const whatsappUrl = buildWhatsAppRequest(form);
    pending = true;
    button.disabled = true;
    button.textContent = 'Sending request…';
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Saving your request securely…';
    whatsapp.hidden = true;
    whatsapp.style.display = 'none';
    instructions.hidden = true;
    copy.hidden = true;
    copy.style.display = 'none';
    copyStatus.textContent = '';
    manualCopy.hidden = true;
    manualCopy.value = '';
    messageToCopy = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: serialized, signal: controller.signal, credentials: 'same-origin' });
      const result = await response.json().catch(() => ({ message: 'The server could not confirm your request. Please try again.' }));
      if (!response.ok) {
        if (result.code === 'idempotency_conflict') key = null;
        for (const [name, message] of Object.entries(result.fields || {})) {
          const field = form.elements.namedItem(name);
          if (field?.setCustomValidity) field.setCustomValidity(message);
        }
        form.reportValidity();
        throw Object.assign(new Error(result.message || 'Unable to save your request right now.'), { allowWhatsApp: response.status >= 500 || response.status === 429 });
      }
      if (!result.ok || typeof result.reference !== 'string') throw Object.assign(new Error('We could not confirm your submission. Please retry or continue on WhatsApp.'), { allowWhatsApp: true });
      status.textContent = `Your request is saved. Reference: ${result.reference}. To arrange your demonstration directly with Shafin, continue on WhatsApp.`;
      const savedUrl = new URL(whatsappUrl);
      savedUrl.searchParams.set('text', `${savedUrl.searchParams.get('text')}\n\nRequest reference: ${result.reference}`);
      showWhatsApp(savedUrl.href);
      form.reset(); key = null; lastPayload = '';
    } catch (error) {
      const network = error.name === 'AbortError' || error instanceof TypeError;
      status.textContent = `${network ? 'We could not confirm your submission. Please try again; retries will not create duplicate requests.' : error.message} You can also reach us directly on WhatsApp using the contact details beside this form.`;
      if (network || error.allowWhatsApp) showWhatsApp(whatsappUrl);
    } finally {
      clearTimeout(timeout); pending = false; button.disabled = false;
      button.textContent = 'Send Request'; form.removeAttribute('aria-busy');
    }
  };
})();
