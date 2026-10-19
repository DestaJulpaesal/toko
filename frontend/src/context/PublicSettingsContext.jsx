import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';

const PublicSettingsContext = createContext({ storeProfile: {} });

export function PublicSettingsProvider({ children }) {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    let active = true;
    apiFetch('/settings/public')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Pengaturan toko publik gagal dimuat.');
        }
        if (active) setSettings(data.settings || {});
      })
      .catch((error) => {
        console.warn('Public store settings unavailable; trying the legacy public profile:', error.message);
        return apiFetch('/site-profile')
          .then(async (response) => {
            const data = await response.json();
            if (!response.ok || !data.success || !data.profile) {
              throw new Error(data.message || 'Profil toko publik gagal dimuat.');
            }
            if (active) {
              setSettings((current) => ({
                ...current,
                storeProfile: {
                  ...(current.storeProfile || {}),
                  ...(data.profile.phone && data.profile.phone !== '081234567890' ? { phone: data.profile.phone } : {}),
                },
              }));
            }
          })
          .catch((profileError) => {
            console.warn('Legacy public profile unavailable; frontend defaults will be used:', profileError.message);
          });
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({
    ...settings,
    storeProfile: settings.storeProfile || {},
  }), [settings]);

  return <PublicSettingsContext.Provider value={value}>{children}</PublicSettingsContext.Provider>;
}

export function usePublicSettings() {
  return useContext(PublicSettingsContext);
}
