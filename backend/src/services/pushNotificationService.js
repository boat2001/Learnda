const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

async function sendPushNotifications(messages) {
  if (!messages.length) return { success: true, sent: 0, invalidTokens: [], errors: [] };

  const chunks = chunkArray(messages, 100);
  let sent = 0;
  const invalidTokens = [];
  const errors = [];

  for (const chunk of chunks) {
    const response = await fetch(EXPO_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(10_000)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.errors?.[0]?.message || `Expo push request failed (${response.status})`);
    }

    const tickets = Array.isArray(payload?.data) ? payload.data : [];
    tickets.forEach((ticket, index) => {
      if (ticket?.status === 'ok') {
        sent += 1;
        return;
      }

      const token = chunk[index]?.to;
      const errorCode = ticket?.details?.error || 'UnknownExpoPushError';
      errors.push({ token, code: errorCode, message: ticket?.message || 'Push delivery rejected' });
      if (errorCode === 'DeviceNotRegistered' && token) {
        invalidTokens.push(token);
      }
    });

    if (!tickets.length) {
      errors.push({ code: 'InvalidExpoResponse', message: 'Expo returned no push tickets' });
    }
  }

  return { success: errors.length === 0, sent, invalidTokens, errors };
}

module.exports = {
  sendPushNotifications
};
