/* AM Motion Lab - helpers shared by all student pages */
(function () {
  var isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  // Where the backend lives: local server while testing, Render when the site is online.
  var API_BASE = isLocal
    ? (location.port === "3000" ? "" : "http://localhost:3000")
    : "https://am-motion-lab.onrender.com";
  var TOKEN_KEY = "amml_token";

  var COURSES = {
    "video-editing": "Video Editing", "2d-animation": "2D Animation",
    "graphic-designing": "Graphic Designing", "motion-graphics": "Motion Graphics",
    "3d-animation": "3D Animation"
  };
  var LEVELS = { basic: "Basic", advanced: "Advanced", professional: "Professional / Job-Oriented" };

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function setToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {} }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

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
})();