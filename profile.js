/**
 * Profile: load name, member since, total focus, bio from Auth + Firestore.
 * Avatar = first name initial if no photo. Edit bio saved to Firestore.
 */
(function () {
  'use strict';

  var profileName = document.getElementById('profile-name');
  var profileMemberSince = document.getElementById('profile-member-since');
  var profileAvatar = document.getElementById('profile-avatar');
  var totalFocusEl = document.getElementById('total-focus');
  var plantsGrownEl = document.getElementById('plants-grown');
  var profileBioText = document.getElementById('profile-bio-text');
  var profileBioEdit = document.getElementById('profile-bio-edit');
  var profileBioInput = document.getElementById('profile-bio-input');
  var profileBioSave = document.getElementById('profile-bio-save');
  var profileBioCancel = document.getElementById('profile-bio-cancel');
  var profileEditBioBtn = document.getElementById('profile-edit-bio-btn');

  function formatFocusTime(totalSeconds) {
    if (totalSeconds == null || totalSeconds < 0) return '00:00';
    var sec = Math.floor(totalSeconds);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function formatMemberSince(timestamp) {
    if (!timestamp) return 'Member since …';
    var date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return 'Member since ' + months[date.getMonth()] + ' ' + date.getFullYear();
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

  function loadFriendsAndRequests(db, uid) {
    var requestsList = document.getElementById('profile-friend-requests-list');
    var friendsList = document.getElementById('profile-friends-list');
    if (!requestsList && !friendsList) return;

    function renderRequests(incoming) {
      if (!requestsList) return;
      requestsList.innerHTML = '';
      if (!incoming || incoming.length === 0) {
        requestsList.innerHTML = '<p class="profile-requests-empty">No pending requests</p>';
        return;
      }
      incoming.forEach(function (req) {
        var row = document.createElement('div');
        row.className = 'profile-friend-request-row';
        row.innerHTML = '<span class="profile-friend-name" data-from-uid="' + escapeHtml(req.fromUid) + '">…</span><div class="profile-friend-actions"><button type="button" class="profile-btn profile-btn-accept" data-action="accept">Accept</button><button type="button" class="profile-btn profile-btn-decline" data-action="decline">Decline</button></div>';
        var nameEl = row.querySelector('.profile-friend-name');
        db.collection('users').doc(req.fromUid).get().then(function (snap) {
          var d = snap.exists ? snap.data() : {};
          var name = d.displayName || nameFromEmail(d.email) || 'Someone';
          if (nameEl) nameEl.textContent = name;
        });
        row.querySelector('[data-action="accept"]').addEventListener('click', function () {
          if (!window.CanopyFriends) return;
          window.CanopyFriends.acceptRequest(db, req.fromUid, uid).then(function () { loadFriendsAndRequests(db, uid); });
        });
        row.querySelector('[data-action="decline"]').addEventListener('click', function () {
          if (!window.CanopyFriends) return;
          window.CanopyFriends.declineRequest(db, req.fromUid, uid).then(function () { loadFriendsAndRequests(db, uid); });
        });
        requestsList.appendChild(row);
      });
    }

    function renderFriends(friendUids) {
      if (!friendsList) return;
      friendsList.innerHTML = '';
      if (!friendUids || friendUids.length === 0) {
        friendsList.innerHTML = '<p class="profile-friends-empty">No friends yet</p>';
        return;
      }
      friendUids.forEach(function (friendUid) {
        var row = document.createElement('div');
        row.className = 'profile-friend-row';
        row.innerHTML = '<span class="profile-friend-name">…</span>';
        var nameEl = row.querySelector('.profile-friend-name');
        db.collection('users').doc(friendUid).get().then(function (snap) {
          var d = snap.exists ? snap.data() : {};
          var name = d.displayName || nameFromEmail(d.email) || 'Unknown';
          if (nameEl) nameEl.textContent = name;
        });
        friendsList.appendChild(row);
      });
    }

    if (!window.CanopyFriends) {
      if (requestsList) requestsList.innerHTML = '<p class="profile-requests-empty">No pending requests</p>';
      if (friendsList) friendsList.innerHTML = '<p class="profile-friends-empty">No friends yet</p>';
      return;
    }

    window.CanopyFriends.getIncomingRequests(db, uid).then(function (incoming) {
      renderRequests(incoming);
    }).catch(function () {
      if (requestsList) requestsList.innerHTML = '<p class="profile-requests-empty">No pending requests</p>';
    });

    db.collection('users').doc(uid).get().then(function (snap) {
      var data = snap.exists ? snap.data() : {};
      var friends = Array.isArray(data.friends) ? data.friends : [];
      renderFriends(friends);
    }).catch(function () {
      if (friendsList) friendsList.innerHTML = '<p class="profile-friends-empty">No friends yet</p>';
    });
  }

  function setAvatar(user, displayName) {
    if (!profileAvatar) return;
    profileAvatar.innerHTML = '';
    var name = displayName || (user && user.displayName) || (user && user.email && user.email.split('@')[0]) || '?';
    var first = name.trim().split(/\s+/)[0] || name;
    var initial = first.charAt(0).toUpperCase();
    if (user && user.photoURL) {
      var img = document.createElement('img');
      img.src = user.photoURL;
      img.alt = '';
      img.className = 'profile-avatar-img';
      profileAvatar.appendChild(img);
    } else {
      var span = document.createElement('span');
      span.className = 'profile-avatar-initial';
      span.textContent = initial;
      profileAvatar.appendChild(span);
    }
  }

  function showBioView() {
    if (profileBioText) profileBioText.style.display = 'block';
    if (profileBioEdit) profileBioEdit.hidden = true;
    if (profileEditBioBtn) profileEditBioBtn.style.display = 'inline-block';
  }

  function showBioEdit(currentBio) {
    if (profileBioText) profileBioText.style.display = 'none';
    if (profileBioEdit) profileBioEdit.hidden = false;
    if (profileBioInput) profileBioInput.value = currentBio || '';
    if (profileEditBioBtn) profileEditBioBtn.style.display = 'none';
  }

  function loadProfile(user) {
    if (!user) {
      if (profileName) profileName.textContent = 'Not logged in';
      if (profileMemberSince) profileMemberSince.textContent = 'Log in to see your profile.';
      if (profileEditBioBtn) profileEditBioBtn.style.display = 'none';
      return;
    }

    var displayName = user.displayName || (user.email && user.email.split('@')[0]) || 'User';
    if (profileName) profileName.textContent = displayName;
    setAvatar(user, displayName);

    if (typeof firebase === 'undefined' || !firebase.firestore) {
      if (profileMemberSince) profileMemberSince.textContent = 'Member since …';
      if (totalFocusEl) totalFocusEl.textContent = '00:00';
      if (profileBioText) profileBioText.textContent = 'No bio yet.';
      if (profileEditBioBtn) profileEditBioBtn.style.display = 'inline-block';
      return;
    }

    var db = firebase.firestore();
    db.collection('users').doc(user.uid).get()
      .then(function (doc) {
        var data = doc.exists ? doc.data() : {};
        if (profileMemberSince) {
          var created = data.createdAt || (user.metadata && user.metadata.creationTime && new Date(user.metadata.creationTime));
          profileMemberSince.textContent = formatMemberSince(created);
        }
        var totalSec = data.totalFocusSeconds;
        if (totalFocusEl) totalFocusEl.textContent = formatFocusTime(totalSec);
        if (plantsGrownEl) plantsGrownEl.textContent = data.plantsGrown != null ? String(data.plantsGrown) : '0';
        var bio = (data.bio || '').trim();
        if (profileBioText) {
          profileBioText.textContent = bio || 'No bio yet.';
          profileBioText.style.display = 'block';
        }
        if (profileBioEdit) profileBioEdit.hidden = true;
        if (profileEditBioBtn) profileEditBioBtn.style.display = 'inline-block';
        loadFriendsAndRequests(db, user.uid);
      })
      .catch(function (err) {
        console.error('Profile load:', err);
        if (profileMemberSince) profileMemberSince.textContent = 'Member since …';
        if (totalFocusEl) totalFocusEl.textContent = '00:00';
        if (profileBioText) profileBioText.textContent = 'No bio yet.';
        if (profileEditBioBtn) profileEditBioBtn.style.display = 'inline-block';
      });
  }

  if (profileEditBioBtn) {
    profileEditBioBtn.addEventListener('click', function () {
      var bio = (profileBioText && profileBioText.textContent !== 'No bio yet.') ? profileBioText.textContent : '';
      showBioEdit(bio);
    });
  }
  if (profileBioCancel) {
    profileBioCancel.addEventListener('click', function () {
      showBioView();
    });
  }
  if (profileBioSave) {
    profileBioSave.addEventListener('click', function () {
      var newBio = (profileBioInput && profileBioInput.value) ? profileBioInput.value.trim() : '';
      var user = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
      if (!user) {
        showBioView();
        return;
      }
      var db = firebase.firestore();
      db.collection('users').doc(user.uid).set({ bio: newBio }, { merge: true })
        .then(function () {
          if (profileBioText) profileBioText.textContent = newBio || 'No bio yet.';
          showBioView();
        })
        .catch(function (err) {
          console.error('Save bio:', err);
          showBioView();
        });
    });
  }

  if (typeof firebase === 'undefined' || !firebase.auth) {
    loadProfile(null);
    return;
  }
  firebase.auth().onAuthStateChanged(loadProfile);
})();
