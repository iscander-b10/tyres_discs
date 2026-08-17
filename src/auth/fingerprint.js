export function getDeviceFingerprint() {
  return JSON.stringify({
    ua: navigator.userAgent,
    platform: navigator.platform,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hw: navigator.hardwareConcurrency || 0,
    mem: navigator.deviceMemory || 0,
    screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
  });
}
