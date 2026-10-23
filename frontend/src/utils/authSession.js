import { clearStaffCaches } from "./catalogStorage";

export function logoutSession(navigate) {
  localStorage.removeItem("glosir_token");
  localStorage.removeItem("glosir_user");
  clearStaffCaches();
  navigate("/login");
}
