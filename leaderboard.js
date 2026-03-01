/**
 * Leaderboard: rank users by totalFocusSeconds (most focus time first).
 */
(function () {
  'use strict';

  function formatFocusTime(totalSeconds) {
    if (totalSeconds == null || totalSeconds < 0) return '0:00';
    var sec = Math.floor(totalSeconds);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function nameFromEmail(email) {
    if (!email || typeof email !== 'string') return '';
    var local = email.split('@')[0];
    return local ? local.charAt(0).toUpperCase() + local.slice(1).toLowerCase() : '';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  var listEl = document.getElementById('leaderboard-list');
  var loadingEl = document.getElementById('leaderboard-loading');

  function setMessage(msg) {
    if (!listEl) return;
    listEl.innerHTML = '<p class="leaderboard-loading">' + escapeHtml(msg) + '</p>';
  }

  function render(users) {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!users || users.length === 0) {
      setMessage('No one on the board yet. Study to climb!');
      return;
    }
    users.forEach(function (u, index) {
      var rank = index + 1;
      var row = document.createElement('div');
      row.className = 'leaderboard-row' + (rank <= 3 ? ' rank-' + rank : '');
      var name = u.displayName || nameFromEmail(u.email) || 'Anonymous';
      row.innerHTML =
        '<span class="leaderboard-rank">' + escapeHtml(String(rank)) + '</span>' +
        '<span class="leaderboard-name">' + escapeHtml(name) + '</span>' +
        '<span class="leaderboard-time">' + escapeHtml(formatFocusTime(u.totalFocusSeconds)) + '</span>';
      listEl.appendChild(row);
    });
  }

  function run() {
    if (typeof firebase === 'undefined' || !firebase.firestore) {
      setMessage('Firebase not loaded.');
      return;
    }
    var db = firebase.firestore();
    db.collection('users').get()
      .then(function (snapshot) {
        var users = [];
        snapshot.forEach(function (doc) {
          var data = doc.data();
          var sec = data.totalFocusSeconds;
          if (sec == null) sec = 0;
          users.push({
            uid: doc.id,
            displayName: data.displayName,
            email: data.email,
            totalFocusSeconds: sec
          });
        });
        users.sort(function (a, b) { return (b.totalFocusSeconds || 0) - (a.totalFocusSeconds || 0); });
        render(users);
      })
      .catch(function (err) {
        console.error('Leaderboard:', err);
        setMessage('Could not load leaderboard.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
