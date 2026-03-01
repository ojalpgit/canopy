/**
 * Friend system: send/accept/decline requests; friend status.
 * Firestore: users/{uid}.friends = array of uids;
 *            friendRequests (collection) doc id = fromUid + '_' + toUid; fields: fromUid, toUid, status, createdAt.
 * Ensure Firestore rules allow: read/write friendRequests; read/write users (for .friends).
 */
(function () {
  'use strict';

  function requestId(fromUid, toUid) {
    return fromUid + '_' + toUid;
  }

  window.CanopyFriends = {
    sendRequest: function (db, fromUid, toUid) {
      if (!fromUid || !toUid || fromUid === toUid) return Promise.reject(new Error('Invalid users'));
      var id = requestId(fromUid, toUid);
      return db.collection('friendRequests').doc(id).set({
        fromUid: fromUid,
        toUid: toUid,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    },

    acceptRequest: function (db, fromUid, toUid) {
      var id = requestId(fromUid, toUid);
      var batch = db.batch();
      var fromRef = db.collection('users').doc(fromUid);
      var toRef = db.collection('users').doc(toUid);
      batch.update(fromRef, { friends: firebase.firestore.FieldValue.arrayUnion(toUid) });
      batch.update(toRef, { friends: firebase.firestore.FieldValue.arrayUnion(fromUid) });
      batch.delete(db.collection('friendRequests').doc(id));
      return batch.commit();
    },

    declineRequest: function (db, fromUid, toUid) {
      var id = requestId(fromUid, toUid);
      return db.collection('friendRequests').doc(id).delete();
    },

    getFriendStatus: function (db, currentUid, otherUid) {
      if (!currentUid || !otherUid || currentUid === otherUid) {
        return Promise.resolve({ status: 'none' });
      }
      var meRef = db.collection('users').doc(currentUid);
      var requestFromMe = db.collection('friendRequests').doc(requestId(currentUid, otherUid));
      var requestToMe = db.collection('friendRequests').doc(requestId(otherUid, currentUid));

      return meRef.get().then(function (meSnap) {
        var friends = (meSnap.exists && meSnap.data().friends) ? meSnap.data().friends : [];
        if (friends.indexOf(otherUid) !== -1) return { status: 'friend' };
        return Promise.all([requestFromMe.get(), requestToMe.get()]).then(function (results) {
          var fromMe = results[0];
          var toMe = results[1];
          if (fromMe.exists && fromMe.data().status === 'pending') return { status: 'pending_sent' };
          if (toMe.exists && toMe.data().status === 'pending') return { status: 'pending_received', fromUid: otherUid };
          return { status: 'none' };
        });
      });
    },

    getIncomingRequests: function (db, toUid) {
      return db.collection('friendRequests')
        .where('toUid', '==', toUid)
        .get()
        .then(function (snap) {
          var list = [];
          snap.forEach(function (doc) {
            var d = doc.data();
            if (d.status !== 'pending') return;
            list.push({ id: doc.id, fromUid: d.fromUid, toUid: d.toUid, createdAt: d.createdAt });
          });
          return list;
        });
    }
  };
})();
