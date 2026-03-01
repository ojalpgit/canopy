/**
 * Critters Near You – find and display users nearby using geolocation + Firestore.
 * Updates current user's location, fetches users with location, filters by distance.
 */
(function () {
  'use strict';

  var MAX_NEARBY_KM = 50;
  var MAX_NEARBY_USERS = 20;
  var LOCATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

  function setGridMessage(msg, isError) {
    var gridEl = document.getElementById('critters-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '<p class="critters-nearby-message' + (isError ? ' critters-nearby-error' : '') + '">' + escapeHtml(msg) + '</p>';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderFriendAction(container, db, meUid, viewedUid, onUpdate) {
    if (!container || !window.CanopyFriends) return;
    container.innerHTML = '<span class="feed-friend-sent">Loading…</span>';
    window.CanopyFriends.getFriendStatus(db, meUid, viewedUid).then(function (result) {
      if (!container) return;
      if (result.status === 'friend') {
        container.innerHTML = '<span class="feed-friend-badges">Friends</span>';
        return;
      }
      if (result.status === 'pending_sent') {
        container.innerHTML = '<span class="feed-friend-sent">Request sent</span>';
        return;
      }
      if (result.status === 'pending_received') {
        container.innerHTML =
          '<button type="button" class="feed-friend-btn feed-friend-accept" data-action="accept">Accept</button>' +
          '<button type="button" class="feed-friend-btn feed-friend-decline" data-action="decline">Decline</button>';
        container.querySelector('[data-action="accept"]').addEventListener('click', function () {
          window.CanopyFriends.acceptRequest(db, viewedUid, meUid).then(function () { if (onUpdate) onUpdate(); renderFriendAction(container, db, meUid, viewedUid, onUpdate); });
        });
        container.querySelector('[data-action="decline"]').addEventListener('click', function () {
          window.CanopyFriends.declineRequest(db, viewedUid, meUid).then(function () { if (onUpdate) onUpdate(); renderFriendAction(container, db, meUid, viewedUid, onUpdate); });
        });
        return;
      }
      container.innerHTML = '<button type="button" class="feed-friend-btn" data-action="add">Add friend</button>';
      container.querySelector('[data-action="add"]').addEventListener('click', function () {
        var btn = container.querySelector('[data-action="add"]');
        if (btn) btn.disabled = true;
        window.CanopyFriends.sendRequest(db, meUid, viewedUid).then(function () {
          renderFriendAction(container, db, meUid, viewedUid, onUpdate);
        }).catch(function () {
          if (btn) btn.disabled = false;
        });
      });
    }).catch(function () {
      if (container) container.innerHTML = '';
    });
  }

  function renderCritters(critters) {
    var gridEl = document.getElementById('critters-grid');
    var profileName = document.getElementById('profile-modal-name');
    var profileBio = document.getElementById('profile-modal-bio');
    var profileAvatar = document.getElementById('profile-modal-avatar');
    var profileOverlay = document.getElementById('profile-overlay');
    var profileClose = document.getElementById('profile-modal-close');
    var profileBackdrop = document.getElementById('profile-overlay-backdrop');
    var friendActionEl = document.getElementById('profile-modal-friend-action');

    if (!gridEl) return;

    gridEl.innerHTML = '';
    critters.forEach(function (c) {
      var item = document.createElement('div');
      item.className = 'critter-item';
      var name = c.displayName || c.name || 'Unknown';
      var initial = name.charAt(0).toUpperCase();
      item.innerHTML =
        '<button type="button" class="critter-button" data-critter-id="' + escapeHtml(c.uid || c.id || '') + '">' +
          '<span class="critter-circle" aria-hidden="true">' +
            (c.photoURL ? '<img src="' + escapeHtml(c.photoURL) + '" alt="" class="critter-circle-img" />' : '<span class="critter-initial">' + escapeHtml(initial) + '</span>') +
          '</span>' +
          '<span class="critter-name">' + escapeHtml(name) + '</span>' +
          (c.distanceKm != null ? '<span class="critter-distance">' + formatDistance(c.distanceKm) + '</span>' : '') +
        '</button>';
      var btn = item.querySelector('.critter-button');
      btn.addEventListener('click', function () {
        if (profileName) profileName.textContent = name;
        if (profileBio) profileBio.textContent = c.bio || c.email || 'No bio yet.';
        if (profileAvatar) {
          profileAvatar.innerHTML = '';
          if (c.photoURL) {
            var img = document.createElement('img');
            img.src = c.photoURL;
            img.alt = '';
            img.className = 'feed-profile-avatar-img';
            profileAvatar.appendChild(img);
          } else {
            var span = document.createElement('span');
            span.className = 'feed-profile-avatar-initial';
            span.textContent = initial;
            profileAvatar.appendChild(span);
          }
        }
        if (profileOverlay) {
          profileOverlay.hidden = false;
          document.body.classList.add('feed-modal-open');
        }
        var auth = firebase.auth();
        var db = firebase.firestore();
        var me = auth.currentUser;
        var viewedUid = c.uid || c.id;
        if (friendActionEl && me && viewedUid && me.uid !== viewedUid) {
          renderFriendAction(friendActionEl, db, me.uid, viewedUid);
        } else if (friendActionEl) {
          friendActionEl.innerHTML = '';
        }
        var msgLink = document.getElementById('profile-modal-msg-link');
        if (msgLink && viewedUid && me && me.uid !== viewedUid) {
          msgLink.href = 'chat.html?with=' + encodeURIComponent(viewedUid);
          msgLink.style.display = 'inline-block';
        } else if (msgLink) {
          msgLink.style.display = 'none';
        }
      });
      gridEl.appendChild(item);
    });
  }

  function formatDistance(km) {
    if (km < 1) return Math.round(km * 1000) + ' m away';
    if (km < 10) return km.toFixed(1) + ' km away';
    return Math.round(km) + ' km away';
  }

  function nameFromEmail(email) {
    if (!email || typeof email !== 'string') return '';
    var local = email.split('@')[0];
    if (!local) return '';
    return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
  }

  function closeProfileModal() {
    var profileOverlay = document.getElementById('profile-overlay');
    if (profileOverlay) profileOverlay.hidden = true;
    document.body.classList.remove('feed-modal-open');
  }

  function run() {
    var gridEl = document.getElementById('critters-grid');
    if (!gridEl) return;

    var profileClose = document.getElementById('profile-modal-close');
    var profileBackdrop = document.getElementById('profile-overlay-backdrop');
    if (profileClose) profileClose.addEventListener('click', closeProfileModal);
    if (profileBackdrop) profileBackdrop.addEventListener('click', closeProfileModal);

    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) {
      setGridMessage('Firebase not loaded.', true);
      return;
    }

    var auth = firebase.auth();
    var db = firebase.firestore();

    setGridMessage('Getting your location…');

    function onLocationError() {
      setGridMessage('Allow location to see critters near you.', true);
    }

    function fetchAndRenderNearby(lat, lng, currentUid) {
      setGridMessage('Finding critters nearby…');
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
              email: data.email,
              bio: data.bio,
              photoURL: data.photoURL,
              distanceKm: distanceKm,
              location: loc
            });
          });
          users.sort(function (a, b) { return a.distanceKm - b.distanceKm; });
          users = users.slice(0, MAX_NEARBY_USERS);
          if (users.length === 0) {
            setGridMessage('No critters nearby right now. Share your location to be found!');
            return;
          }
          renderCritters(users);
        })
        .catch(function (err) {
          console.error('Feed nearby:', err);
          setGridMessage('Could not load nearby critters. Try again.', true);
        });
    }

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        setGridMessage('Log in to see critters near you.', true);
        return;
      }

      if (!navigator.geolocation) {
        setGridMessage('Location not supported.', true);
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
            .then(function () { fetchAndRenderNearby(lat, lng, user.uid); })
            .catch(function (err) {
              console.error('Update location:', err);
              fetchAndRenderNearby(lat, lng, user.uid);
            });
        },
        function () { onLocationError(); },
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
