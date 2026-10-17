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
  if (/\b(easing|ease in|ease out|ease in out)\b/.test(text)) {
    return "Easing controls how an animation speeds up or slows down. Ease-in starts gently and accelerates; ease-out slows before it stops; ease-in-out does both. Use the graph editor or keyframe interpolation controls to shape the motion, then preview it to check that it feels natural.";
  }
  if (/\b(squash and stretch|squash stretch)\b/.test(text)) {
    return "Squash and stretch is an animation principle that changes an object's shape as it moves. A soft object may squash on impact and stretch while moving quickly. Keep its overall volume consistent so the motion feels lively without making the object appear to grow or shrink.";
  }
  if (/\b(mask|masking)\b/.test(text)) {
    return "A mask controls which parts of a layer are visible. You can use a shape or path to reveal, hide, or isolate part of an image or video without deleting the original layer. Animate the mask when you want the visible area to change over time.";
  }
  if (/\b(layers?|layer order)\b/.test(text)) {
    return "Layers keep video, images, text, shapes, and effects separate in a project. Their stacking order controls what appears in front: higher layers usually cover lower ones. Naming and grouping layers makes a project easier to edit.";
  }
  if (/\b(composition|visual hierarchy)\b/.test(text)) {
    return "Composition is how visual elements are arranged inside a frame. Give the main subject clear emphasis, use spacing and alignment to guide the viewer, and keep secondary details from competing with the main message. Check the layout at the final viewing size.";
  }
  if (/\b(resolution|1080p|4k|pixels)\b/.test(text)) {
    return "Resolution describes the pixel dimensions of an image or video frame. Higher resolution can preserve more detail, but it also creates larger files and takes more processing. Choose a resolution that matches the intended platform or delivery requirement, and keep the project and export settings consistent.";
  }
  if (/\b(color correction|white balance|exposure)\b/.test(text)) {
    return "Color correction adjusts an image toward a clean, consistent starting point. First check exposure and contrast, then correct white balance so neutral objects look neutral. Match shots before adding a creative color grade, and review the result on the full sequence.";
  }
  if (/\b(vector|raster|pixel image)\b/.test(text)) {
    return "Vector artwork is made from paths and shapes, so it can usually scale without becoming pixelated. Raster artwork is made from a grid of pixels and can lose sharpness when enlarged too far. Logos and icons are often kept as vectors; photos are typically raster images.";
  }
  if (/\b(render|export|codec|bitrate)\b/.test(text)) {
    return "Rendering or exporting creates a final video file from the editable project. Choose the required frame size and frame rate first, then select a format and quality suitable for the destination. Preview the exported file to check picture, audio, and timing before sharing it.";
  }
  return "";
}

async function generateStudyAnswer(question, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY || "";

  // Answer common course concepts immediately instead of waiting on an AI API call.
  const instantAnswer = offlineCourseAnswer(question);
  if (instantAnswer) return { answered: true, answer: instantAnswer, source: "course-faq" };
  if (!apiKey) return { answered: false, answer: FALLBACK, source: "fallback" };

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
      const timeout = setTimeout(() => controller.abort(), 6000);
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
    // Keep backup attempts short and only retry transient overload/server failures.
    for (const fallbackModel of [FALLBACK_MODEL, SECOND_FALLBACK_MODEL]) {
      const retryable = result.timedOut || (result.response && [408, 429, 500, 502, 503, 504].includes(result.response.status));
      if (!retryable) break;
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
