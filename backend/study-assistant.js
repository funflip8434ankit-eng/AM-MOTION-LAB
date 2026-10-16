const { COURSES } = require("./curriculum");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.6-flash";
const SECOND_FALLBACK_MODEL = process.env.GEMINI_SECOND_FALLBACK_MODEL || "gemini-3.8-flash";
const FALLBACK = "I can’t confidently answer that from the AM Motion Lab course outline yet. Please send it to the teaching team through the Contact page.";

function courseContext(courseId) {
  const entries = Object.entries(COURSES).filter(([id]) => !courseId || id === courseId);
  return entries.map(([id, course]) => [
    course.name + " (" + id + ")",
    "Overview: " + course.overview,
    ...course.lessons.map((lesson) => "- " + lesson.title + ": " + lesson.outcome),
  ].join("\n")).join("\n\n");
}

function offlineCourseAnswer(question) {
  const text = String(question || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/\bkeyframes?\b/.test(text)) {
    return "A keyframe is a point on the timeline where you set a value, such as an object's position, scale, or rotation. Set one value at the start and a different value later; the animation software creates the in-between motion. Adjust the timing and spacing to control how quickly the movement starts, changes, and stops.";
  }
  if (/\b(frame rate|frames per second|fps)\b/.test(text)) {
    return "Frame rate is how many still images (frames) play each second, usually written as FPS. It affects how motion looks and should be chosen for the project before editing or animation. Keep the sequence and export settings consistent unless you have a specific delivery reason to change them.";
  }
  if (/\b(timeline|track|ripple edit)\b/.test(text)) {
    return "A timeline arranges video, audio, titles, and other layers over time. Tracks keep those elements organised. Trimming changes a clip's visible duration; a ripple edit also closes or opens the gap so later clips move with the edit.";
  }
  if (/\b(motion graphics|motion design)\b/.test(text)) {
    return "Motion graphics use animated text, shapes, and images to communicate an idea. Start with a clear message, make the most important element easy to read, then use timing and movement to guide attention. Keep motion purposeful so it supports the message.";
  }
  if (/\b(timing and spacing|spacing in animation|animation timing)\b/.test(text)) {
    return "Timing is how long an action takes; spacing is how far an object moves between frames. Close spacing makes movement slower, while wider spacing makes it faster. Varying both helps show weight, acceleration, and the character of an action.";
  }
  return "";
}

async function generateStudyAnswer(question, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("Study assistant is not configured.");

  // Answer common course concepts immediately instead of waiting on an AI API call.
  const instantAnswer = offlineCourseAnswer(question);
  if (instantAnswer) return { answered: true, answer: instantAnswer, source: "course-faq" };

  const selectedCourse = options.courseId && COURSES[options.courseId] ? options.courseId : "";
  const instruction = [
    "You are the AM Motion Lab study assistant. Help learners with study questions about video editing, 2D animation, 3D animation, graphic design, and motion graphics.",
    "Use the course outline below as the source for AM Motion Lab-specific facts. You may explain a basic concept in these fields using general knowledge, but never claim that an unlisted topic, fee, schedule, software version, or feature is included in an AM Motion Lab course.",
    "If the question is unrelated to these study areas, asks for an AM Motion Lab fact absent from the outline, or you cannot answer confidently, reply exactly with HANDOFF: followed by a short explanation. Do not guess.",
    "For an answer, begin exactly with SUPPORTED: and then give a clear, practical answer. Keep it concise (about 120 words), use simple language, and match the learner’s language (Hindi/Hinglish or English). Do not include markdown tables.",
    options.emailReply ? "This is an email reply to a student. Be warm and professional. Mention that the answer is AI-generated from the available course outline and invite them to reply if they need teacher help." : "",
    selectedCourse ? "The learner is currently studying " + COURSES[selectedCourse].name + ". Prefer this course when relevant." : "",
    "Course outline:\n" + courseContext(selectedCourse),
  ].filter(Boolean).join("\n\n");

  const contents = (Array.isArray(options.history) ? options.history : []).map((item) => ({
    role: item.role === "model" ? "model" : "user",
    parts: [{ text: item.text }],
  }));
  contents.push({ role: "user", parts: [{ text: question }] });

  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: instruction }] },
    contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
    });
    const requestModel = async (model) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: requestBody,
        });
        return { response, data: await response.json(), timedOut: false };
      } catch (err) {
        if (controller.signal.aborted) return { response: null, data: null, timedOut: true };
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    };
    let currentModel = MODEL;
    let result = await requestModel(currentModel);
    // Keep one backup attempt so an overloaded model cannot hold the chat for too long.
    for (const fallbackModel of [FALLBACK_MODEL]) {
      if (!result.timedOut && result.response.status !== 503) break;
      if (!fallbackModel || fallbackModel === currentModel) continue;
      console.warn("Gemini model " + currentModel + (result.timedOut ? " timed out" : " is overloaded") + "; retrying with " + fallbackModel + ".");
      currentModel = fallbackModel;
      result = await requestModel(currentModel);
    }
    const { response, data } = result;
    if (result.timedOut) {
      const localAnswer = offlineCourseAnswer(question);
      if (localAnswer) return { answered: true, answer: localAnswer, source: "course-faq" };
      throw new Error("Gemini API request timed out on model " + currentModel + ".");
    }
    if (!response.ok) {
      const localAnswer = offlineCourseAnswer(question);
      if (localAnswer) return { answered: true, answer: localAnswer, source: "course-faq" };
      const apiMessage = data && data.error && typeof data.error.message === "string"
        ? data.error.message.replace(/[\r\n]+/g, " ").slice(0, 400)
        : "No error details returned.";
      throw new Error("Gemini API HTTP " + response.status + ": " + apiMessage);
    }
    const text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts || [])
      .map((part) => part.text || "")
      .join("\n")
      .trim();
    if (text.startsWith("SUPPORTED:")) {
      const answer = text.slice("SUPPORTED:".length).trim();
      if (answer) return { answered: true, answer: answer.slice(0, 5000) };
    }
    if (text.startsWith("HANDOFF:")) {
      const localAnswer = offlineCourseAnswer(question);
      if (localAnswer) return { answered: true, answer: localAnswer, source: "course-faq" };
      return { answered: false, answer: FALLBACK };
    }
    return { answered: false, answer: FALLBACK };
}

module.exports = { generateStudyAnswer, FALLBACK };
