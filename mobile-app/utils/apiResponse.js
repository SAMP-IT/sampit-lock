export const unwrapResponseData = (response, fallback = null) => {
  if (!response) {
    return fallback;
  }

  if (response.data && typeof response.data.data !== 'undefined') {
    return response.data.data ?? fallback;
  }

  if (typeof response.data !== 'undefined') {
    return response.data ?? fallback;
  }

  return response ?? fallback;
};

export const unwrapResponseArray = (response) => {
  const data = unwrapResponseData(response, []);
  return Array.isArray(data) ? data : [];
};
