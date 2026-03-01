(function () {
  'use strict';

  var WISC_DOMAIN = 'wisc.edu';

  var form = document.getElementById('login-form');
  var emailInput = document.getElementById('login-email');
  var passwordInput = document.getElementById('login-password');
  var emailError = document.getElementById('login-email-error');
  var passwordError = document.getElementById('login-password-error');
  var firebaseError = document.getElementById('login-firebase-error');
  var submitBtn = document.getElementById('login-submit');

  function clearErrors() {
    emailError.textContent = '';
    passwordError.textContent = '';
    firebaseError.textContent = '';
    emailInput.classList.remove('invalid');
    passwordInput.classList.remove('invalid');
  }

  function setSubmitLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Logging in…' : 'Log in';
  }

  function isValidWiscEmail(email) {
    if (!email || typeof email !== 'string') return false;
    var trimmed = email.trim().toLowerCase();
    return trimmed.endsWith('@' + WISC_DOMAIN) && trimmed.length > WISC_DOMAIN.length + 2;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    var email = emailInput.value.trim();
    var password = passwordInput.value;

    var hasError = false;
    if (!email) {
      emailError.textContent = 'Enter your email';
      emailInput.classList.add('invalid');
      hasError = true;
    } else if (!isValidWiscEmail(email)) {
      emailError.textContent = 'Use a @wisc.edu email';
      emailInput.classList.add('invalid');
      hasError = true;
    }
    if (!password) {
      passwordError.textContent = 'Enter your password';
      passwordInput.classList.add('invalid');
      hasError = true;
    } else if (password.length < 6) {
      passwordError.textContent = 'Password must be 6+ characters';
      passwordInput.classList.add('invalid');
      hasError = true;
    }
    if (hasError) return;

    if (typeof firebase === 'undefined' || !firebase.auth) {
      firebaseError.textContent = 'Firebase not loaded. Add your config in firebase-config.js';
      return;
    }

    setSubmitLoading(true);
    var auth = firebase.auth();
    auth.signInWithEmailAndPassword(email, password)
      .then(function () {
        window.location.href = 'home.html';
      })
      .catch(function (err) {
        setSubmitLoading(false);
        var message = err.message || 'Login failed. Try again.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          message = 'No account with this email. Sign up first.';
        } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          message = 'Wrong password.';
        } else if (err.code === 'auth/invalid-email') {
          message = 'Use a valid @wisc.edu email.';
        }
        firebaseError.textContent = message;
      });
  });

  emailInput.addEventListener('input', function () {
    emailError.textContent = '';
    emailInput.classList.remove('invalid');
  });
  passwordInput.addEventListener('input', function () {
    passwordError.textContent = '';
    passwordInput.classList.remove('invalid');
  });
})();
