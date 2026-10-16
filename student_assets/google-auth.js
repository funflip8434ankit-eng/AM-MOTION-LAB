(function () {
  "use strict";
  var target = document.getElementById("googleSignInButton");
  var message = document.getElementById("googleAuthMessage");
  if (!target || !window.AMML) return;

  function showMessage(text, isError) {
    if (!message) return;
    message.textContent = text || "";
    message.style.color = isError ? "#f87171" : "";
  }

  function destination() {
    var next = new URLSearchParams(location.search).get("next");
    return next === "courses" ? "../courses.html" : next === "certificates" ? "certificate-center.html" : "dashboard.html";
  }

  function loadGoogleScript() {
    return new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
      var script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initialize() {
    try {
      var config = await window.AMML.api("/api/auth/google/client-id");
      await loadGoogleScript();
      window.google.accounts.id.initialize({
        client_id: config.clientId,
        callback: async function (response) {
          showMessage("Signing in with Google…", false);
          try {
            var result = await window.AMML.api("/api/auth/google", {
              method: "POST",
              body: { credential: response.credential },
            });
            window.AMML.setToken(result.token);
            location.href = destination();
          } catch (err) {
            showMessage(err.message || "Google sign-in failed. Please try again.", true);
          }
        },
      });
      window.google.accounts.id.renderButton(target, {
        type: "standard", theme: "filled_black", size: "large", shape: "pill", text: "continue_with", width: 300,
      });
    } catch (err) {
      showMessage("Google sign-in setup is not available yet. Use email and password for now.", false);
    }
  }

  initialize();
})();
