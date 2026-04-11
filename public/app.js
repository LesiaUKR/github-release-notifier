document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('subscribe-form');
  var messageDiv = document.getElementById('message');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    messageDiv.className = 'message';
    messageDiv.style.display = 'none';

    var email = document.getElementById('email').value.trim();
    var repo = document.getElementById('repo').value.trim();

    if (!/^[^/]+\/[^/]+$/.test(repo)) {
      showMessage('error', 'Repository must be in owner/repo format (e.g. facebook/react)');
      return;
    }

    var button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Subscribing...';

    fetch('/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, repo: repo }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (res.ok) {
            showMessage('success', 'Check your email to confirm your subscription!');
            form.reset();
          } else {
            showMessage('error', data.message || 'Something went wrong');
          }
        });
      })
      .catch(function () {
        showMessage('error', 'Network error. Please try again.');
      })
      .finally(function () {
        button.disabled = false;
        button.textContent = 'Subscribe';
      });
  });

  function showMessage(type, text) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
  }
});
