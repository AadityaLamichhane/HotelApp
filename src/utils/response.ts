export const ok = (data: unknown) => ({ success: true, data });

export const fail = (message: string, error = "Error") => ({
  success: false,
  error,
  message,
});
