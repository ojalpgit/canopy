/**
 * Real-time chat with one user. URL: chat.html?with=OTHER_UID.
 * Firestore: conversations/{convId} (participants, lastMessage, lastAt);
 *            conversations/{convId}/messages (fromUid, text, createdAt).
 * convId = sorted uids: uid1_uid2 (uid1 < uid2).
 */
(function () {
  'use strict';

  function getParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

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

  var messagesEl = document.getElementById('chat-messages');
  var loadingEl = document.getElementById('chat-loading');
  var formEl = document.getElementById('chat-form');
  var inputEl = document.getElementById('chat-input');
  var sendBtn = document.getElementById('chat-send');
  var titleEl = document.getElementById('chat-title');

  function setLoading(show) {
    if (loadingEl) loadingEl.hidden = !show;
  }

  function ensureConversation(db, convId, myUid, otherUid) {
    var ref = db.collection('conversations').doc(convId);
    return ref.get().then(function (snap) {
      if (snap.exists) return convId;
      return ref.set({
        participants: myUid < otherUid ? [myUid, otherUid] : [otherUid, myUid],
        lastMessage: '',
        lastAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function () { return convId; });
    });
  }

  function renderMessage(msg, isMine) {
    var div = document.createElement('div');
    div.className = 'chat-bubble ' + (isMine ? 'chat-bubble-mine' : 'chat-bubble-theirs');
    div.textContent = msg.text || '';
    return div;
  }

  function run() {
    var otherUid = getParam('with');
    if (!otherUid) {
      setLoading(false);
      if (messagesEl) {
        messagesEl.innerHTML = '<p class="chat-loading">Open a chat from Messages.</p>';
      }
      return;
    }

    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) {
      setLoading(false);
      if (messagesEl) messagesEl.innerHTML = '<p class="chat-loading">Firebase not loaded.</p>';
      return;
    }

    var auth = firebase.auth();
    var db = firebase.firestore();

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        setLoading(false);
        if (messagesEl) messagesEl.innerHTML = '<p class="chat-loading">Log in to chat.</p>';
        return;
      }
      if (user.uid === otherUid) {
        setLoading(false);
        if (messagesEl) messagesEl.innerHTML = '<p class="chat-loading">You cannot chat with yourself.</p>';
        return;
      }

      var convId = conversationId(user.uid, otherUid);

      db.collection('users').doc(otherUid).get().then(function (snap) {
        var data = snap.exists ? snap.data() : {};
        var name = data.displayName || (data.email && data.email.split('@')[0]) || 'Unknown';
        if (titleEl) titleEl.textContent = name;
      });

      ensureConversation(db, convId, user.uid, otherUid).then(function () {
        setLoading(false);
        if (messagesEl) messagesEl.innerHTML = '';

        var messagesRef = db.collection('conversations').doc(convId).collection('messages');

        messagesRef.orderBy('createdAt', 'asc').onSnapshot(function (snapshot) {
          if (!messagesEl) return;
          messagesEl.innerHTML = '';
          snapshot.forEach(function (doc) {
            var d = doc.data();
            var isMine = d.fromUid === user.uid;
            messagesEl.appendChild(renderMessage(d, isMine));
          });
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }, function (err) {
          console.error('Chat snapshot:', err);
          messagesEl.innerHTML = '<p class="chat-loading">Could not load messages.</p>';
        });
      }).catch(function (err) {
        console.error('Ensure conversation:', err);
        setLoading(false);
        if (messagesEl) messagesEl.innerHTML = '<p class="chat-loading">Could not start chat.</p>';
      });

      if (formEl && inputEl && sendBtn) {
        formEl.addEventListener('submit', function (e) {
          e.preventDefault();
          var text = (inputEl.value || '').trim();
          if (!text) return;
          sendBtn.disabled = true;
          var convRef = db.collection('conversations').doc(convId);
          convRef.collection('messages').add({
            fromUid: user.uid,
            text: text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then(function () {
            inputEl.value = '';
            convRef.update({
              lastMessage: text,
              lastAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }).catch(function (err) {
            console.error('Send message:', err);
          }).then(function () {
            sendBtn.disabled = false;
          });
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
