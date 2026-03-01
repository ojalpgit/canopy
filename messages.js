/**
 * Messages list: show conversations for current user (real-time).
 * Firestore: conversations/{convId} with participants, lastMessage, lastAt;
 *            convId = sorted uids: uid1_uid2 (uid1 < uid2).
 * Query uses array-contains only (no composite index required); sort by lastAt in memory.
 */
(function () {
  'use strict';

  function conversationId(uid1, uid2) {
    if (!uid1 || !uid2) return '';
    return uid1 < uid2 ? uid1 + '_' + uid2 : uid2 + '_' + uid1;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function nameFromEmail(email) {
    if (!email || typeof email !== 'string') return '';
    var local = email.split('@')[0];
    return local ? local.charAt(0).toUpperCase() + local.slice(1).toLowerCase() : 'Unknown';
  }

  function renderConversations(db, myUid, listEl) {
    if (!listEl) return;
    listEl.innerHTML = '<p class="messages-loading">Loading…</p>';

    db.collection('conversations')
      .where('participants', 'array-contains', myUid)
      .onSnapshot(
        function (snapshot) {
          listEl.innerHTML = '';
          if (snapshot.empty) {
            listEl.innerHTML = '<p class="messages-empty">No conversations yet. Start a chat from the Feed or a friend\'s profile.</p>';
            return;
          }
          var convs = [];
          snapshot.forEach(function (doc) {
            var d = doc.data();
            var otherUid = (d.participants && d.participants[0] === myUid) ? d.participants[1] : d.participants[0];
            convs.push({
              convId: doc.id,
              otherUid: otherUid,
              lastMessage: d.lastMessage || '',
              lastAt: d.lastAt
            });
          });
          convs.sort(function (a, b) {
            var ta = a.lastAt && (a.lastAt.toMillis ? a.lastAt.toMillis() : a.lastAt);
            var tb = b.lastAt && (b.lastAt.toMillis ? b.lastAt.toMillis() : b.lastAt);
            return (tb || 0) - (ta || 0);
          });
          convs.forEach(function (c) {
            var li = document.createElement('li');
            li.className = 'messages-item';
            var lastPreview = c.lastMessage ? (c.lastMessage.length > 40 ? c.lastMessage.slice(0, 40) + '…' : c.lastMessage) : 'No messages yet';
            li.innerHTML =
              '<a href="chat.html?with=' + encodeURIComponent(c.otherUid) + '" class="messages-entry">' +
                '<div class="messages-avatar messages-avatar-initial" data-uid="' + escapeHtml(c.otherUid) + '" aria-hidden="true"></div>' +
                '<div class="messages-text">' +
                  '<span class="messages-name" data-uid="' + escapeHtml(c.otherUid) + '">…</span>' +
                  '<span class="messages-status">' + escapeHtml(lastPreview) + '</span>' +
                '</div>' +
              '</a>';
            listEl.appendChild(li);
            db.collection('users').doc(c.otherUid).get().then(function (snap) {
              var data = snap.exists ? snap.data() : {};
              var name = data.displayName || nameFromEmail(data.email) || 'Unknown';
              var initial = name.charAt(0).toUpperCase();
              var avatar = li.querySelector('.messages-avatar');
              var nameEl = li.querySelector('.messages-name');
              if (nameEl) nameEl.textContent = name;
              if (avatar) {
                if (data.photoURL) {
                  avatar.innerHTML = '<img src="' + escapeHtml(data.photoURL) + '" alt="" class="messages-avatar-img" />';
                  avatar.classList.remove('messages-avatar-initial');
                } else {
                  avatar.textContent = initial;
                  avatar.classList.add('messages-avatar-initial');
                }
              }
            });
          });
        },
        function (err) {
          console.error('Messages list:', err);
          listEl.innerHTML = '<p class="messages-empty">Could not load conversations.</p>';
        }
      );
  }

  function run() {
    var listEl = document.getElementById('messages-list');
    if (!listEl) return;
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) {
      listEl.innerHTML = '<p class="messages-empty">Firebase not loaded.</p>';
      return;
    }
    var auth = firebase.auth();
    var db = firebase.firestore();
    auth.onAuthStateChanged(function (user) {
      if (!user) {
        listEl.innerHTML = '<p class="messages-empty">Log in to see messages.</p>';
        return;
      }
      renderConversations(db, user.uid, listEl);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
