export function customPrompt(message, defaultValue = '', placeholder = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'kimo-modal-overlay';
    overlay.style.background = 'none';
    overlay.style.backdropFilter = 'none';
    overlay.innerHTML = `<div class="kimo-modal-card" style="max-width:380px;width:90%;padding:22px 22px 18px;text-align:left;">
      <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:14px;">${message}</div>
      <input type="text" class="kimo-prompt-input" id="kimo-prompt-input" value="${(defaultValue || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" placeholder="${placeholder}" />
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
        <button data-act="cancel" class="kimo-modal-btn-cancel">取消</button>
        <button data-act="ok" style="padding:7px 18px;font-size:13px;background:rgb(var(--dynamic-color,16,185,129));border:none;color:#fff;border-radius:6px;cursor:pointer;font-weight:600;">确定</button>
      </div>
    </div>`;

    const finish = (value) => {
      overlay.classList.add('is-closing');
      setTimeout(() => {
        overlay.remove();
        resolve(value);
      }, 200);
    };

    overlay.addEventListener('click', (event) => {
      const action = event.target.dataset?.act;
      if (action === 'ok') finish(overlay.querySelector('#kimo-prompt-input').value);
      else if (action === 'cancel' || event.target === overlay) finish(null);
    });

    const input = overlay.querySelector('#kimo-prompt-input');
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') finish(input.value);
      else if (event.key === 'Escape') finish(null);
    });

    document.body.appendChild(overlay);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
  });
}

export function customConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'kimo-modal-overlay';
    overlay.style.background = 'none';
    overlay.style.backdropFilter = 'none';
    overlay.innerHTML = `<div class="kimo-modal-card" style="max-width:360px;width:90%;padding:22px;text-align:left;">
      <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">确认</div>
      <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">${message}</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">
        <button data-act="cancel" class="kimo-modal-btn-cancel">取消</button>
        <button data-act="ok" style="padding:7px 18px;font-size:13px;background:rgb(var(--dynamic-color,239,68,68));border:none;color:#fff;border-radius:6px;cursor:pointer;font-weight:600;">确定</button>
      </div>
    </div>`;

    const keyHandler = (event) => {
      if (event.key === 'Escape') finish(false);
    };

    const finish = (value) => {
      document.removeEventListener('keydown', keyHandler);
      overlay.classList.add('is-closing');
      setTimeout(() => {
        overlay.remove();
        resolve(value);
      }, 200);
    };

    overlay.addEventListener('click', (event) => {
      const action = event.target.dataset?.act;
      if (action === 'ok') finish(true);
      else if (action === 'cancel' || event.target === overlay) finish(false);
    });

    document.addEventListener('keydown', keyHandler);
    document.body.appendChild(overlay);
  });
}
