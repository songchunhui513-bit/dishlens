/* global App */
const auth = require("./utils/auth");

App({
  globalData: {
    sessionReady: false,
    user: null
  },

  onLaunch() {
    auth.silentLogin()
      .then((session) => {
        this.globalData.sessionReady = Boolean(session && session.token);
        this.globalData.user = session ? session.user : null;
      })
      .catch(() => {
        this.globalData.sessionReady = false;
      });
  }
});
