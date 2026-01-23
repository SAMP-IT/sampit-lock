const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  return fallback;
};

const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

export const normalizeLockSettings = (raw = {}) => {
  // Handle nested data format
  const source = raw?.data?.data || raw?.data || raw || {};

  console.log('[normalizeLockSettings] Input:', raw);
  console.log('[normalizeLockSettings] Source:', source);

  return {
    // Basic lock settings
    autoLockEnabled: toBoolean(source.auto_lock_enabled ?? source.autoLockEnabled, true),
    autoLockDelay: toNumber(source.auto_lock_delay ?? source.autoLockDelay, 30),
    remoteUnlockEnabled: toBoolean(source.remote_unlock_enabled ?? source.remoteUnlockEnabled, true),
    passageModeEnabled: toBoolean(source.passage_mode_enabled ?? source.passageModeEnabled, false),
    passageModeStart: source.passage_mode_start ?? source.passageModeStart ?? null,
    passageModeEnd: source.passage_mode_end ?? source.passageModeEnd ?? null,

    // Sound settings
    lockSoundVolume: toNumber(source.sound_volume ?? source.lock_sound_volume ?? source.lockSoundVolume, 50),
    soundEnabled: toBoolean(source.sound_enabled ?? source.soundEnabled, true),
    lockSoundEnabled: toBoolean(source.sound_enabled ?? source.soundEnabled ?? source.lockSoundEnabled, true),

    // One-touch and LED
    oneTouchLocking: toBoolean(source.one_touch_locking ?? source.oneTouchLocking, false),
    ledEnabled: toBoolean(source.led_enabled ?? source.ledEnabled, true),

    // Security settings
    tamperAlert: toBoolean(source.tamper_alert ?? source.tamperAlert ?? source.tamper_alert_enabled, true),
    tamperAlertEnabled: toBoolean(source.tamper_alert_enabled ?? source.tamper_alert ?? source.tamperAlert, true),
    wrongCodeLockout: toBoolean(source.wrong_code_lockout ?? source.wrongCodeLockout, true),
    privacyLock: toBoolean(source.privacy_lock ?? source.privacyLock, false),
    antiPeepPassword: toBoolean(source.anti_peep_password ?? source.antiPeepPassword, false),

    // Reset button (Bluetooth-only setting)
    resetButtonEnabled: toBoolean(source.reset_button_enabled ?? source.resetButtonEnabled, true),
  };
};

export const coerceBoolean = toBoolean;
