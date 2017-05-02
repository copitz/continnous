import moment from 'moment';
import Firebase from '../../../firebase';
import auth from '../../../auth';
import ResourceImage from './Image';
import Item from '../../../models/Item';

const viewed = {};

export default {
  components: { ResourceImage },
  methods: {
    /**
     * @deprecated Use Item.getFirebaseRef()
     *
     * @param pathArgs Args for {@link getFirebasePath}
     * @return {firebase.database.Reference}
     */
    getFirebaseRef(...pathArgs) {
      return Firebase.database().ref(this.getFirebasePath(...pathArgs));
    },
    /**
     * @deprecated Use Item.getFirebasePath()
     *
     * @param branch
     * @param id
     * @param personal
     * @param type
     * @returns {string}
     */
    getFirebasePath(branch, id, personal, type) {
      let archive = branch;
      if (typeof archive === 'string') {
        // Legacy stuff
        archive = archive === 'archive';
      }
      return Item.getFirebasePath(
        this.organization,
        type || this.type,
        archive === undefined ? this.archive : archive,
        personal === undefined ? this.personal : personal,
        id
      );
    },
    /**
     * @deprecated Use new Item()
     *
     * @param {String} id
     * @param {Object} data
     * @param {String} resource
     * @param {Boolean} personal
     * @return {Item}
     */
    createItem(id, data, resource, personal) {
      return new Item(id, data, resource, undefined, personal).setPermissions(this.permissions);
    },
    /**
     * @deprecated Use Item.prepareForFirebase()
     *
     * @param {Item} item
     * @return {Object}
     */
    prepareItemForFirebase(item) {
      return item instanceof Item ? item.prepareForFirebase() : item;
    },
    moment(time) {
      return moment(time);
    },
    getLikesRef(id, all, byUser) {
      const path = '/likes/organizations/' + this.organization.key + '/by' + (byUser ? 'User' : 'Resource');
      const lastParts = [id, auth.user.uid];
      if (byUser) {
        lastParts.reverse();
      }
      if (all) {
        return Firebase.database().ref(path + '/' + lastParts.shift());
      }
      return Firebase.database().ref(path + '/' + lastParts.join('/'));
    },
    setLike(item, like) {
      const byResourceRef = this.getLikesRef(item.id, false, false);
      const byUserRef = this.getLikesRef(item.id, false, true);
      const factor = auth.user.elevate ? auth.user.elevate + 1 : 1;
      (like ? byResourceRef.set(factor) : byResourceRef.remove()).then(() => {
        (like ? byUserRef.set(factor) : byUserRef.remove()).then(() => {
          if (!item.stats) {
            item.stats = {};
          }
          item.stats.likes = Math.max(0, (item.stats.likes || 0) + (like ? 1 : -1));
          this.getFirebaseRef(this.archive ? 'archive' : 'resources', item.id).child('stats').update({
            likes: item.stats.likes
          });

          this.updateRank(item);

          if (like) {
            this.organization.journal.addEntry(item, this.type, this.personal, 'like');
          } else {
            // Remove all like journal entries
            this.organization.journal.getRef().orderByChild('id').equalTo(item.id).once('value', (snapshot) => {
              snapshot.forEach((childSnapshot) => {
                const entry = childSnapshot.val();
                if (entry.uid === auth.user.uid && entry.action === 'like') {
                  childSnapshot.ref.remove();
                }
              });
            });
          }
        });
      });
    },
    trackView(item) {
      if (!this.trackedViews) {
        this.trackedViews = {};
      }
      if (this.trackedViews[item.id]) {
        return;
      }
      this.trackedViews[item.id] = true;
      if (!viewed[auth.user.uid]) {
        viewed[auth.user.uid] = {};
      }
      const statsRef = this.getFirebaseRef(this.archive ? 'archive' : 'resources', item.id).child('stats');
      if (!viewed[auth.user.uid][item.id]) {
        viewed[auth.user.uid][item.id] = true;
        Firebase.database().ref(
          '/views/organizations/' + this.organization.key + '/' + item.id + '/' + auth.user.uid
        ).once('value', (sn) => {
          if (!sn.val()) {
            sn.ref.set(1);
            if (!item.stats) {
              item.stats = {};
            }
            item.stats.uniqueViews = (item.stats.uniqueViews || 0) + 1;
            statsRef.update({
              uniqueViews: item.stats.uniqueViews
            });
          }
        });
      }
      statsRef.update({
        views: item.stats && item.stats.views ? item.stats.views + 1 : 1
      });
    },
    updateRank(item) {
      Promise.all([
        new Promise((resolve) => {
          this.getLikesRef(item.id, true, false).once('value', (sn) => {
            let sumLikes = 0;
            sn.forEach((csn) => {
              sumLikes += csn.val();
            });
            resolve(sumLikes / (item.stats ? item.stats.uniqueViews || 1 : 1));
          });
        }),
        new Promise((resolve) => {
          Firebase.database().ref(
            '/scorings/organizations/' + this.organization.key + '/' + item.id
          ).once('value', (sn) => {
            let sumScorings = 0;
            let numScorings = 0;
            sn.forEach((csn) => {
              let sumCriteria = 0;
              let numCriteria = 0;
              let factor = 1;
              csn.forEach((ccsn) => {
                if (ccsn.key === '_elevate') {
                  factor += ccsn.val();
                } else {
                  sumCriteria += ccsn.val();
                  numCriteria++;
                }
              });
              /* eslint-disable no-underscore-dangle */
              sumScorings += factor * (numCriteria ? sumCriteria / numCriteria : 0);
              numScorings += factor;
            });
            resolve(numScorings ? sumScorings / numScorings : 0);
          });
        }),
      ]).then((factors) => {
        let sum = 0;
        factors.forEach((factor) => { sum += factor; });
        this.getFirebaseRef(this.archive ? 'archive' : 'resources', item.id).update({
          rank: sum / factors.length
        });
      });
    }
  },
};
