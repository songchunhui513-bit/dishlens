export function isReusableExistingImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;

  // Local generated images are machine-local artifacts. They are fine for the
  // current response when the file exists, but unsafe to reuse from DB rows on
  // another host because they often 404 after deploy.
  if (url.startsWith("/generated-dishes/")) return false;
  if (url.startsWith("/dishes/")) return true;

  if (/images\.unsplash\.com|image\.pollinations\.ai|dashscope-result.*aliyuncs\.com/i.test(url)) {
    return false;
  }

  return true;
}
