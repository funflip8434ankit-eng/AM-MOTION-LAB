(function () {
  if (!window.AMML) return;

  var history = [];
  var params = new URLSearchParams(location.search);
  var courseId = params.get("course") || "";
  var wrapper = document.createElement("aside");
  wrapper.className = "study-chat";
  wrapper.innerHTML = [
    '<button class="study-chat__launcher" type="button" aria-expanded="false" aria-controls="study-chat-panel">',
    '<span aria-hidden="true">✦</span> Study Q&amp;A',
    '</button>',
    '<section class="study-chat__panel" id="study-chat-panel" role="dialog" aria-label="AM Motion Lab study assistant" hidden>',
    '  <header class="study-chat__header"><div><strong>Study assistant</strong><small>Ask about course topics</small></div><button class="study-chat__close" type="button" aria-label="Close study assistant">×</button></header>',
    '  <div class="study-chat__messages" aria-live="polite" aria-relevant="additions">',
    '    <p class="study-chat__bubble study-chat__bubble--assistant">Ask a question about your studies. Answers use the course outline and may not always be correct. Your question is sent to Google Gemini; please do not include personal or payment details.</p>',
    '  </div>',
    '  <form class="study-chat__form"><label class="study-chat__sr-only" for="study-chat-question">Your study question</label><textarea id="study-chat-question" maxlength="1200" rows="2" placeholder="Type your study question…" required></textarea><button type="submit">Send</button></form>',
    '</section>',
  ].join("");
  document.body.appendChild(wrapper);

  var launcher = wrapper.querySelector(".study-chat__launcher");
  var panel = wrapper.querySelector(".study-chat__panel");
  var close = wrapper.querySelector(".study-chat__close");
  var messages = wrapper.querySelector(".study-chat__messages");
  var form = wrapper.querySelector(".study-chat__form");
  var input = wrapper.querySelector("textarea");
  var send = form.querySelector("button[type=submit]");

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    if (open) input.focus();
    else launcher.focus();
  }

  function addBubble(text, role) {
    var bubble = document.createElement("p");
    bubble.className = "study-chat__bubble study-chat__bubble--" + role;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  launcher.addEventListener("click", function () { setOpen(panel.hidden); });
  close.addEventListener("click", function () { setOpen(false); });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var question = input.value.trim();
    if (question.length < 2 || send.disabled) return;

    var previousHistory = history.slice(-8);
    addBubble(question, "user");
    input.value = "";
    if (!AMML.getToken()) {
      var loginBubble = addBubble("Please sign in to use Study Q&A.", "assistant");
      var loginLink = document.createElement("a");
      loginLink.href = (location.pathname.indexOf("/student/") >= 0 ? "" : "student/") + "login.html";
      loginLink.textContent = "Sign in to AM Motion Lab";
      loginBubble.appendChild(document.createElement("br"));
      loginBubble.appendChild(loginLink);
      return;
    }
    input.disabled = true;
    send.disabled = true;
    send.textContent = "…";
    var pending = addBubble("Thinking…", "assistant");

    try {
      var result = await AMML.api("/api/study/ask", {
        method: "POST",
        body: { question: question, courseId: courseId, history: previousHistory },
      });
      pending.textContent = result.answer;
      if (history.length < 24) history.push({ role: "user", text: question }, { role: "model", text: result.answer });
    } catch (error) {
      pending.textContent = error.message || "The study assistant is temporarily unavailable. Please try again later.";
    } finally {
      input.disabled = false;
      send.disabled = false;
      send.textContent = "Send";
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }
  });
})();
