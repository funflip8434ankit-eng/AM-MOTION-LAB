/* AM Motion Lab - helpers shared by all student pages */
(function () {
  var isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  // Where the backend lives: local server while testing, Render when the site is online.
  var API_BASE = isLocal
    ? (location.port === "3000" ? "" : "http://localhost:3000")
    : "https://am-motion-lab-9ui2.onrender.com";
  var TOKEN_KEY = "amml_token";

  var COURSES = {
    "video-editing": "Video Editing", "2d-animation": "2D Animation",
    "graphic-designing": "Graphic Designing", "motion-graphics": "Motion Graphics",
    "3d-animation": "3D Animation"
  };
  var LEVELS = { basic: "Basic", advanced: "Advanced", professional: "Professional / Job-Oriented" };

  function getToken() {
    try {
      var token = sessionStorage.getItem(TOKEN_KEY) || "";
      // Move existing sessions out of persistent storage once, then remove the old copy.
      if (!token) {
        token = localStorage.getItem(TOKEN_KEY) || "";
        if (token) {
          sessionStorage.setItem(TOKEN_KEY, token);
          localStorage.removeItem(TOKEN_KEY);
        }
      }
      return token;
    } catch (e) { return ""; }
  }
  function setToken(t) {
    try { sessionStorage.setItem(TOKEN_KEY, t); localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = { "Content-Type": "application/json" };
    var t = getToken();
    if (t) headers.Authorization = "Bearer " + t;
    var res;
    try {
      res = await fetch(API_BASE + path, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    } catch (e) {
      throw new Error("Cannot reach the server. Please check your internet and try again.");
    }
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var err = new Error(data.error || "Something went wrong. Please try again.");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  window.AMML = {
    api: api, getToken: getToken, setToken: setToken, clearToken: clearToken, API_BASE: API_BASE,
    courseName: function (id) { return COURSES[id] || id; },
    levelName: function (id) { return LEVELS[id] || id; }
  };

  document.querySelectorAll('input[type="password"]').forEach(function (input) {
    var field = input.parentElement;
    if (!field || field.querySelector(".password-toggle")) return;
    var control = document.createElement("div");
    control.className = "password-control";
    input.parentNode.insertBefore(control, input);
    control.appendChild(input);
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-toggle";
    toggle.setAttribute("aria-label", "Show password");
    toggle.setAttribute("aria-pressed", "false");
    toggle.setAttribute("aria-controls", input.id);
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path class="password-eye-open" d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle class="password-eye-open" cx="12" cy="12" r="2.7"/><path class="password-eye-closed" d="m3 3 18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6.1 0 9.5 6 9.5 6a15 15 0 0 1-2.5 3.1M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.4 6 9.5 6c1.2 0 2.3-.3 3.3-.7"/></svg>';
    input.insertAdjacentElement("afterend", toggle);
    toggle.addEventListener("click", function () {
      var visible = input.type === "password";
      input.type = visible ? "text" : "password";
      toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
      toggle.setAttribute("aria-pressed", String(visible));
      input.focus();
    });
  });

  (function initAuthNavigation() {
    var path = location.pathname;
    var desktopNav = document.querySelector(".nav__links");
    var mobileMenu = document.getElementById("mobileMenu");
    if (!desktopNav && !mobileMenu) return;
    var inStudentFolder = /\/student\//i.test(path);
    var loginHref = (inStudentFolder ? "" : "student/") + "login.html";

    function hasSession() {
      var token = getToken();
      if (!token) return false;
      try {
        var payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (payload.exp && payload.exp * 1000 <= Date.now()) { clearToken(); return false; }
      } catch (e) { clearToken(); return false; }
      return true;
    }

    function render(container, mobile) {
      if (!container) return;
      container.querySelectorAll(".nav-auth-control").forEach(function (node) { node.remove(); });
      var loggedIn = hasSession();
      if (!loggedIn) {
        var loginLink = document.createElement("a");
        loginLink.className = "nav-auth-control";
        loginLink.href = loginHref;
        loginLink.textContent = "Log in";
        container.appendChild(loginLink);
      } else {
        var logout = document.createElement("button");
        logout.type = "button";
        logout.className = "nav-auth-control nav-auth-logout";
        logout.textContent = "Log out";
        logout.addEventListener("click", function () {
          clearToken();
          location.reload();
        });
        container.appendChild(logout);
      }
    }

    render(desktopNav, false);
    render(mobileMenu, true);
  })();
})();
