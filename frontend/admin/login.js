const loginForm = document.getElementById('admin-login-form');
const tokenInput = document.getElementById('admin-token');
const message = document.getElementById('login-message');

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  message.textContent = 'Signing in…';
  message.className = 'admin-message';

  try {
    const response = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenInput.value })
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') {
      throw new Error(payload.message || 'Sign-in failed.');
    }
    tokenInput.value = '';
    window.location.replace('/admin/');
  } catch (error) {
    message.textContent = error.message;
    message.className = 'admin-message error';
    tokenInput.select();
  }
});
