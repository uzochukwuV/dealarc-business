import { useState, useEffect, useCallback } from 'react';
import { getActiveOrganizationId, getCurrentUser, getOrganization } from '@/lib/backend-auth';

export function useOnboarding() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [store, setStore] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getCurrentUser();
      setUser(me);

      const orgId = getActiveOrganizationId(me.id);
      if (!orgId) {
        setOrganization(null);
        setStore(null);
        setProgress(null);
        return;
      }

      const org = await getOrganization(orgId);
      setOrganization(org);
      setStore(null);
      setProgress(null);
    } catch {
      setUser(null);
      setOrganization(null);
      setStore(null);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, user, progress, organization, store, refetch: load };
}
