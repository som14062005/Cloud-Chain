export function saveToken(token: string) {
  localStorage.setItem("consentchain_token", token);
}

export function getToken(): string | null {
  return localStorage.getItem("consentchain_token");
}

export function removeToken() {
  localStorage.removeItem("consentchain_token");
}
