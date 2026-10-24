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
  window.submitEnquiry = event => {
    event.preventDefault();
    for (const field of form.elements) {
      if (field.required && typeof field.value === 'string') field.setCustomValidity(field.value.trim() ? '' : 'Please fill out this field.');
    }
    const data = new FormData(form);
    const phone = String(data.get('phone') || '').trim();
    const digits = phone.replace(/\D/g, '');
    const phoneField = form.elements.namedItem('phone');
    phoneField.setCustomValidity(/^[+\d\s().-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15 ? '' : 'Enter a valid phone number with 7–15 digits.');
    if (!form.reportValidity()) return;
    if (String(data.get('website') || '').trim()) {
      status.textContent = 'Please leave the website field empty and try again.';
      return;
    }
    copyStatus.textContent = '';
    manualCopy.hidden = true;
    manualCopy.value = '';
    const whatsappUrl = buildWhatsAppRequest(form);
    showWhatsApp(whatsappUrl);
    status.textContent = 'Opening WhatsApp with your request. Review the message and tap Send in WhatsApp.';
    // Navigate during the submit gesture: no async wait or popup blocking on mobile.
    // Keep the form intact so visitors can return and retry or copy their message.
    window.location.assign(whatsappUrl);
  };
  button.disabled = false;
})();
