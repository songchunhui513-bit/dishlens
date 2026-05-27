const API_BASE_URL = "https://dishlens.wukongmkt.com";

module.exports = {
  API_BASE_URL,
  H5_SHARE_BASE_URL: `${API_BASE_URL}/share`,
  STORAGE_KEYS: {
    session: "dishlens_wechat_session",
    result: "dishlens_last_result",
    pendingPhotos: "dishlens_pending_photos",
    selectedDish: "dishlens_selected_dish",
    profileDraft: "dishlens_profile_draft"
  }
};
