const parseUserAgent = (userAgent = '') => {
  const ua = String(userAgent || '');
  const browserChecks = [
    ['Edge', /Edg\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/],
    ['Firefox', /Firefox\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];
  const osChecks = [
    ['Windows', /Windows NT ([\d.]+)/],
    ['Android', /Android ([\d.]+)/],
    ['iOS', /OS ([\d_]+) like Mac OS X/],
    ['macOS', /Mac OS X ([\d_]+)/],
    ['Linux', /Linux/],
  ];

  let browser_name = null;
  let browser_version = null;
  for (const [name, pattern] of browserChecks) {
    const match = ua.match(pattern);
    if (match) {
      browser_name = name;
      browser_version = String(match[1] || '').replace(/_/g, '.');
      break;
    }
  }

  let os_name = null;
  let os_version = null;
  for (const [name, pattern] of osChecks) {
    const match = ua.match(pattern);
    if (match) {
      os_name = name;
      os_version = String(match[1] || '').replace(/_/g, '.');
      break;
    }
  }

  const is_mobile = /Mobile|Android|iPhone|iPad/i.test(ua);

  return {
    browser_name,
    browser_version,
    os_name,
    os_version,
    device_type: is_mobile ? 'mobile' : 'desktop',
    is_mobile,
  };
};

export const collectClientContext = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {};
  }

  const parsedUserAgent = parseUserAgent(navigator.userAgent);

  return {
    ...parsedUserAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    language: navigator.language || null,
    platform: navigator.userAgentData?.platform || navigator.platform || null,
    device_vendor: navigator.userAgentData?.brands?.[0]?.brand || null,
    device_model: navigator.userAgentData?.model || null,
    screen_width: window.screen?.width || window.innerWidth || null,
    screen_height: window.screen?.height || window.innerHeight || null,
    referrer: document.referrer || null,
  };
};

export default collectClientContext;
