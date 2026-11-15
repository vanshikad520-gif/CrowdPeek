import { login } from "./api.js";
import { postLoginDestination, saveSession } from "./auth.js";
import { renderShell } from "./ui.js";

renderShell();
const form = document.getElementById("login-form");
const generalError = document.getElementById("form-error");
const submitButton = form.querySelector('button[type="submit"]');

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  generalError.classList.add("d-none");
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const emailInput = form.elements.email;
  const passwordInput = form.elements.password;
  emailInput.classList.remove("is-invalid");
  passwordInput.classList.remove("is-invalid");
  emailInput.removeAttribute("aria-invalid");
  passwordInput.removeAttribute("aria-invalid");
  const errorMessage = !email ? "Enter your email address."
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Enter a valid email address."
      : !password ? "Enter your password." : "";
  if (errorMessage) {
    generalError.textContent = errorMessage;
    generalError.classList.remove("d-none");
    const invalidInput = !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? emailInput : passwordInput;
    invalidInput.classList.add("is-invalid");
    invalidInput.setAttribute("aria-invalid", "true");
    invalidInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Signing in…";
  try {
    const session = await login(email, password);
    saveSession(session);
    window.location.assign(postLoginDestination());
  } catch (error) {
    generalError.textContent = error.status === 401 ? "Email or password is incorrect." : error.message || "Email or password is incorrect.";
    generalError.classList.remove("d-none");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Sign in";
  }
});
