let currentToast = null;
let currentToastTimer = null;

export function showToast(message) {
  if (currentToast) {
    clearTimeout(currentToastTimer);
    currentToast.classList.remove('show');
    setTimeout(() => {
      if (currentToast?.parentNode) currentToast.remove();
    }, 400);
  }

  const toast = document.createElement('div');
  toast.className = 'kimo-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  currentToast = toast;

  setTimeout(() => toast.classList.add('show'), 10);
  currentToastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (currentToast === toast) currentToast = null;
      toast.remove();
    }, 400);
  }, 3000);
}
