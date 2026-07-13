const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";
const storagePrefix = "sme_";

function getStorage() {
  if (!isBrowser) {
    return null;
  }

  return window.localStorage;
}

export const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (!isBrowser) {
    return defaultValue ?? null;
  }

  const storage = getStorage();
  const storageKey = `${storagePrefix}${paramName}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);

  if (removeFromUrl) {
    urlParams.delete(paramName);
    const nextUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }

  if (searchParam) {
    storage?.setItem(storageKey, searchParam);
    return searchParam;
  }

  if (defaultValue !== undefined && defaultValue !== null) {
    storage?.setItem(storageKey, defaultValue);
    return defaultValue;
  }

  const storedValue = storage?.getItem(storageKey);
  return storedValue ?? null;
};

export const getAppParams = () => {
  if (!isBrowser) {
    return {
      appId: null,
      token: null,
      fromUrl: null,
      functionsVersion: null,
      appBaseUrl: null,
    };
  }

  const storage = getStorage();
  if (getAppParamValue("clear_access_token") === "true") {
    storage?.removeItem(`${storagePrefix}access_token`);
    storage?.removeItem(`${storagePrefix}token`);
  }

  return {
    appId: getAppParamValue("app_id"),
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
    functionsVersion: getAppParamValue("functions_version"),
    appBaseUrl: getAppParamValue("app_base_url"),
  };
};

export const appParams = {
  ...getAppParams(),
};
