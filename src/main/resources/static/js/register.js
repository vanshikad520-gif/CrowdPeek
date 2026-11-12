import { register } from "./api.js";
import { postLoginDestination, saveSession } from "./auth.js";
import { renderShell } from "./ui.js";

renderShell();
const form = document.getElementById("register-form");
const generalError = document.getElementById("form-error");
const submitButton = form.querySelector('button[type="submit"]');

function setFieldError(field, message) {
  const input = document.getElementById(field);
  input.classList.toggle("is-invalid", Boolean(message));
  input.setAttribute("aria-invalid", String(Boolean(message)));
  if (message && generalError.classList.contains("d-none")) {
    generalError.textContent = message;
    generalError.classList.remove("d-none");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  generalError.classList.add("d-none");
  const name = form.elements.name.value.trim();
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const confirmation = form.elements.confirmPassword.value;
  let valid = true;
  generalError.classList.add("d-none");
  generalError.textContent = "";
  ["name", "email", "password", "confirm-password"].forEach((field) => setFieldError(field, ""));
  if (!name) { setFieldError("name", "Enter your name."); valid = false; }
  if (!email) { setFieldError("email", "Enter your email address."); valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError("email", "Enter a valid email address."); valid = false; }
  if (password.length < 6) { setFieldError("password", "Use a password with at least 6 characters."); valid = false; }
  if (!confirmation) { setFieldError("confirm-password", "Confirm your password."); valid = false; }
  else if (password !== confirmation) { setFieldError("confirm-password", "Passwords do not match."); valid = false; }
  if (!valid) return;

  submitButton.disabled = true;
  submitButton.textContent = "Creating account…";
  try {
    const session = await register(name, email, password);
    saveSession(session);
    window.location.assign(postLoginDestination());
  } catch (error) {
    generalError.textContent = error.message || "Your account could not be created. Please try again.";
    generalError.classList.remove("d-none");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create account";
  }
});
