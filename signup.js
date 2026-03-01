(function () {
  'use strict';

  var WISC_DOMAIN = 'wisc.edu';

  var form = document.getElementById('signup-form');
  var nameInput = document.getElementById('signup-name');
  var emailInput = document.getElementById('signup-email');
  var passwordInput = document.getElementById('signup-password');
  var nameError = document.getElementById('signup-name-error');
  var emailError = document.getElementById('signup-email-error');
  var passwordError = document.getElementById('signup-password-error');
  var firebaseError = document.getElementById('signup-firebase-error');
  var submitBtn = document.getElementById('signup-submit');

  function clearErrors() {
    nameError.textContent = '';
    emailError.textContent = '';
    passwordError.textContent = '';
    firebaseError.textContent = '';
    nameInput.classList.remove('invalid');
    emailInput.classList.remove('invalid');
    passwordInput.classList.remove('invalid');
  }

  function setSubmitLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Signing up…' : 'Sign up';
  }

  function isValidWiscEmail(email) {
    if (!email || typeof email !== 'string') return false;
    var trimmed = email.trim().toLowerCase();
    return trimmed.endsWith('@' + WISC_DOMAIN) && trimmed.length > WISC_DOMAIN.length + 2;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    var displayName = nameInput.value.trim();
    var email = emailInput.value.trim();
    var password = passwordInput.value;

    var hasError = false;
    if (!displayName) {
      nameError.textContent = 'Enter your full name';
      nameInput.classList.add('invalid');
      hasError = true;
    }
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
      passwordError.textContent = 'Enter a password';
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

    auth.createUserWithEmailAndPassword(email, password)
      .then(function (userCredential) {
        var user = userCredential.user;
        return user.updateProfile({ displayName: displayName }).then(function () {
          // Redirect immediately so we never get stuck on Firestore
          window.location.href = 'home.html';
          // Optionally save profile to Firestore in the background (do not await)
          if (typeof firebase.firestore === 'function') {
            try {
              var db = firebase.firestore();
              db.collection('users').doc(user.uid).set({
                displayName: displayName,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              }).catch(function () {});
            } catch (e) {}
          }
        });
      })
      .catch(function (err) {
        setSubmitLoading(false);
        var message = err.message || 'Sign up failed. Try again.';
        if (err.code === 'auth/email-already-in-use') {
          message = 'This email is already registered. Log in instead.';
        } else if (err.code === 'auth/invalid-email') {
          message = 'Use a valid @wisc.edu email.';
        } else if (err.code === 'auth/weak-password') {
          message = 'Use a stronger password (6+ characters).';
        }
        firebaseError.textContent = message;
      });
  });

  nameInput.addEventListener('input', function () {
    nameError.textContent = '';
    nameInput.classList.remove('invalid');
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
