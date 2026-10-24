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
  whatsapp.hidden = true;
  whatsapp.style.cssText = 'display:none;margin-top:.75rem;color:inherit;text-decoration:underline';
  form.append(whatsapp);
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: serialized, signal: controller.signal, credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) {
        if (result.code === 'idempotency_conflict') key = null;
        for (const [name, message] of Object.entries(result.fields || {})) {
          const field = form.elements.namedItem(name);
          if (field?.setCustomValidity) field.setCustomValidity(message);
        }
        form.reportValidity();
        throw new Error(result.message || 'Unable to save your request right now.');
      }
      status.textContent = `Your request is saved. Reference: ${result.reference}. To arrange your demonstration directly with Shafin, continue on WhatsApp.`;
      whatsapp.href = whatsappUrl;
      whatsapp.hidden = false;
      whatsapp.style.display = 'inline-block';
      form.reset(); key = null; lastPayload = '';
    } catch (error) {
      const network = error.name === 'AbortError' || error instanceof TypeError;
      status.textContent = `${network ? 'We could not confirm your submission. Please try again; retries will not create duplicate requests.' : error.message} You can also reach us directly on WhatsApp using the contact details beside this form.`;
    } finally {
      clearTimeout(timeout); pending = false; button.disabled = false;
      button.textContent = 'Send Request'; form.removeAttribute('aria-busy');
    }
  };
})();
