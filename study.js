/**
 * Study page: nearby users (same as feed), select partner, timer with Pause/Stop, coins earned.
 * Coins use same localStorage key as den (den_coins).
 */
(function () {
  'use strict';

  var MAX_NEARBY_KM = 50;
  var MAX_NEARBY_USERS = 20;
  var LOCATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  var COINS_KEY = 'den_coins';
  var COINS_PER_MINUTE = 1;
  var DEFAULT_COINS = 150;

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function nameFromEmail(email) {
    if (!email || typeof email !== 'string') return '';
    var local = email.split('@')[0];
    return local ? local.charAt(0).toUpperCase() + local.slice(1).toLowerCase() : '';
  }

  function loadCoins() {
    var raw = localStorage.getItem(COINS_KEY);
    if (raw === null) return DEFAULT_COINS;
    var n = parseInt(raw, 10);
    return isNaN(n) ? DEFAULT_COINS : Math.max(0, n);
  }

  function saveCoins(amount) {
    localStorage.setItem(COINS_KEY, String(amount));
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var state = {
    nearbyUsers: [],
    selectedUser: null,
    timerRunning: false,
    timerPaused: false,
    timerStart: null,
    totalPausedMs: 0,
    pausedAt: null,
    lastCoinMinute: 0,
    coinsThisSession: 0
  };

  var listEl = document.getElementById('nearby-list');
  var hintEl = document.getElementById('nearby-hint');
  var studyingNameEl = document.getElementById('studying-name');
  var studyingAvatarEl = document.getElementById('studying-avatar');
  var startBtn = document.getElementById('start-timer-btn');
  var pauseBtn = document.getElementById('pause-timer-btn');
  var stopBtn = document.getElementById('stop-timer-btn');
  var timerEl = document.getElementById('timer');
  var coinEl = document.getElementById('study-coin-count');
  var timerBox = document.getElementById('timer-box');

  function updateCoinDisplay() {
    var total = loadCoins();
    if (coinEl) coinEl.textContent = total;
  }

  function getElapsedSeconds() {
    if (!state.timerStart) return 0;
    var now = state.timerPaused ? state.pausedAt : Date.now();
    var runningMs = now - state.timerStart - state.totalPausedMs;
    return Math.max(0, Math.floor(runningMs / 1000));
  }

  function tick() {
    if (!state.timerRunning || state.timerPaused || !state.timerStart || !timerEl) return;
    var sec = getElapsedSeconds();
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    timerEl.textContent = pad(m) + ':' + pad(s);
    var minutes = Math.floor(sec / 60);
    if (minutes > state.lastCoinMinute) {
      var add = minutes - state.lastCoinMinute;
      state.lastCoinMinute = minutes;
      state.coinsThisSession += add;
      var total = loadCoins() + add;
      saveCoins(total);
      updateCoinDisplay();
    }
  }

  function setTimerButtons(running, paused) {
    if (startBtn) startBtn.hidden = running;
    if (pauseBtn) {
      pauseBtn.hidden = !running;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    }
    if (stopBtn) stopBtn.hidden = !running;
  }

  function startTimer() {
    state.timerRunning = true;
    state.timerPaused = false;
    state.timerStart = state.timerStart || Date.now();
    state.totalPausedMs = 0;
    state.pausedAt = null;
    state.lastCoinMinute = 0;
    state.coinsThisSession = 0;
    setTimerButtons(true, false);
    if (startBtn) startBtn.disabled = true;
    tick();
  }

  function pauseTimer() {
    if (!state.timerRunning) return;
    if (state.timerPaused) {
      state.timerPaused = false;
      state.totalPausedMs += (Date.now() - state.pausedAt);
      state.pausedAt = null;
      if (pauseBtn) pauseBtn.textContent = 'Pause';
    } else {
      state.timerPaused = true;
      state.pausedAt = Date.now();
      if (pauseBtn) pauseBtn.textContent = 'Resume';
    }
  }

  function stopTimer() {
    var elapsedSec = getElapsedSeconds();
    if (state.timerRunning) {
      var minutes = Math.floor(elapsedSec / 60);
      if (minutes > state.lastCoinMinute) {
        var add = minutes - state.lastCoinMinute;
        var total = loadCoins() + add;
        saveCoins(total);
        updateCoinDisplay();
      }
      if (elapsedSec > 0 && typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
        var auth = firebase.auth();
        var user = auth.currentUser;
        if (user) {
          var db = firebase.firestore();
          db.collection('users').doc(user.uid).set({
            totalFocusSeconds: firebase.firestore.FieldValue.increment(elapsedSec)
          }, { merge: true }).catch(function (err) { console.error('Update focus time:', err); });
        }
      }
    }
    state.timerRunning = false;
    state.timerPaused = false;
    state.timerStart = null;
    state.totalPausedMs = 0;
    state.pausedAt = null;
    state.lastCoinMinute = 0;
    if (timerEl) timerEl.textContent = '00:00';
    setTimerButtons(false, false);
    if (startBtn) startBtn.disabled = false;
  }

  function updateStudyingWith(user) {
    var name = (user && (user.displayName || user.name)) || 'Select someone above';
    if (studyingNameEl) studyingNameEl.textContent = name;
    if (studyingAvatarEl) {
      studyingAvatarEl.innerHTML = '';
      if (user && user.photoURL) {
        var img = document.createElement('img');
        img.src = user.photoURL;
        img.alt = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        studyingAvatarEl.appendChild(img);
      } else {
        var initial = name.charAt(0).toUpperCase();
        var span = document.createElement('span');
        span.style.fontSize = '2rem';
        span.style.fontFamily = 'inherit';
        span.textContent = initial;
        studyingAvatarEl.appendChild(span);
      }
    }
  }

  function renderNearbyList(users) {
    if (!listEl) return;
    listEl.innerHTML = '';
    state.nearbyUsers = users || [];
    if (!users || users.length === 0) {
      if (hintEl) hintEl.textContent = 'No one nearby. Open the Feed and allow location to be found!';
      return;
    }
    if (hintEl) {
      hintEl.textContent = 'Tap someone to study with:';
      hintEl.classList.remove('study-nearby-loading');
    }
    users.forEach(function (u) {
      var li = document.createElement('li');
      li.className = 'study-nearby-item';
      if (state.selectedUser && state.selectedUser.uid === u.uid) li.classList.add('selected');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'study-nearby-btn';
      btn.textContent = u.displayName || u.name || 'Unknown';
      btn.setAttribute('data-uid', u.uid);
      btn.addEventListener('click', function () {
        state.selectedUser = u;
        renderNearbyList(state.nearbyUsers);
        updateStudyingWith(u);
        if (startBtn) startBtn.hidden = false;
      });
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  function fetchNearby(lat, lng, currentUid) {
    if (typeof firebase === 'undefined' || !firebase.firestore) {
      if (hintEl) hintEl.textContent = 'Firebase not loaded.';
      return;
    }
    var db = firebase.firestore();
    db.collection('users').get()
      .then(function (snapshot) {
        var now = Date.now();
        var users = [];
        snapshot.forEach(function (doc) {
          var data = doc.data();
          if (doc.id === currentUid) return;
          var loc = data.location;
          if (!loc || !loc.latitude || !loc.longitude) return;
          var updated = data.locationUpdatedAt && data.locationUpdatedAt.toMillis ? data.locationUpdatedAt.toMillis() : 0;
          if (now - updated > LOCATION_MAX_AGE_MS) return;
          var distanceKm = haversineKm(lat, lng, loc.latitude, loc.longitude);
          if (distanceKm > MAX_NEARBY_KM) return;
          var name = data.displayName || nameFromEmail(data.email) || 'Unknown';
          users.push({
            uid: doc.id,
            displayName: name,
            name: name,
            email: data.email,
            photoURL: data.photoURL,
            distanceKm: distanceKm
          });
        });
        users.sort(function (a, b) { return a.distanceKm - b.distanceKm; });
        users = users.slice(0, MAX_NEARBY_USERS);
        renderNearbyList(users);
      })
      .catch(function (err) {
        console.error('Study nearby:', err);
        if (hintEl) hintEl.textContent = 'Could not load nearby. Try again.';
      });
  }

  function run() {
    updateCoinDisplay();
    setTimerButtons(false, false);
    if (pauseBtn) pauseBtn.hidden = true;
    if (stopBtn) stopBtn.hidden = true;

    if (startBtn) startBtn.addEventListener('click', function () {
      startTimer();
    });
    if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
    if (stopBtn) stopBtn.addEventListener('click', stopTimer);

    setInterval(tick, 1000);

    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) {
      if (hintEl) hintEl.textContent = 'Firebase not loaded. Log in on the app first.';
      return;
    }

    var auth = firebase.auth();
    var db = firebase.firestore();

    if (hintEl) {
      hintEl.textContent = 'Getting your location…';
      hintEl.classList.add('study-nearby-loading');
    }

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        if (hintEl) hintEl.textContent = 'Log in to see who\'s nearby.';
        return;
      }
      if (!navigator.geolocation) {
        if (hintEl) hintEl.textContent = 'Location not supported.';
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (position) {
          var lat = position.coords.latitude;
          var lng = position.coords.longitude;
          var userRef = db.collection('users').doc(user.uid);
          var payload = {
            location: new firebase.firestore.GeoPoint(lat, lng),
            locationUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          if (user.displayName) payload.displayName = user.displayName;
          if (user.email) payload.email = user.email;
          if (user.photoURL) payload.photoURL = user.photoURL;
          userRef.set(payload, { merge: true })
            .then(function () { fetchNearby(lat, lng, user.uid); })
            .catch(function () { fetchNearby(lat, lng, user.uid); });
        },
        function () {
          if (hintEl) hintEl.textContent = 'Allow location to see who\'s nearby.';
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
