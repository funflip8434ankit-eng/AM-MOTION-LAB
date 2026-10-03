/* =========================================================
   AM MOTION LAB — script.js
   Learn • Create • Earn
   Vanilla JS. No dependencies except optional EmailJS (CDN).
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     1. CONFIG
     ========================================================= */
  const EMAILJS_CONFIG = {
    serviceId: "YOUR_SERVICE_ID",
    templateId: "YOUR_TEMPLATE_ID",
    publicKey: "YOUR_PUBLIC_KEY",
  };

  // EmailJS is only considered "configured" once the placeholders above
  // have been replaced with real values.
  function isEmailJsConfigured() {
    return (
      EMAILJS_CONFIG.serviceId &&
      EMAILJS_CONFIG.templateId &&
      EMAILJS_CONFIG.publicKey &&
      !EMAILJS_CONFIG.serviceId.startsWith("YOUR_") &&
      !EMAILJS_CONFIG.templateId.startsWith("YOUR_") &&
      !EMAILJS_CONFIG.publicKey.startsWith("YOUR_")
    );
  }

  const MAX_FILE_SIZE_MB = 20;
  const ALLOWED_FILE_TYPES = [".pdf", ".jpg", ".jpeg", ".png", ".mp4"];

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =========================================================
     2. DOM REFERENCES
     ========================================================= */
  const nav = document.getElementById("nav");
  const navBurger = document.getElementById("navBurger");
  const mobileMenu = document.getElementById("mobileMenu");

  const revealEls = document.querySelectorAll("[data-reveal]");

  const learnCards = document.querySelectorAll(".learn-card");
  const courseButtons = document.querySelectorAll("[data-course]");
  const projectButtons = document.querySelectorAll("[data-project]");

  const modalOverlay = document.getElementById("modalOverlay");
  const modalClose = document.getElementById("modalClose");
  const modalContent = document.getElementById("modalContent");

  const processLineFill = document.querySelector(".process__line-fill");
  const processTrack = document.querySelector(".process__track");

  const accordionItems = document.querySelectorAll(".accordion__item");

  const enquiryForm = document.getElementById("enquiryForm");
  const enquiryStatus = document.getElementById("enquiryStatus");

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileChosen = document.getElementById("fileChosen");
  const fileNameEl = document.getElementById("fileName");
  const fileRemoveBtn = document.getElementById("fileRemove");

  const yearEl = document.getElementById("year");

  /* =========================================================
     3. NAVIGATION
     ========================================================= */
  (function initNavScrollState() {
    if (!nav) return;

    function updateNavState() {
      if (window.scrollY > 12) {
        nav.classList.add("is-scrolled");
      } else {
        nav.classList.remove("is-scrolled");
      }
    }

    updateNavState();
    window.addEventListener("scroll", updateNavState, { passive: true });
  })();

  // All internal anchor links (desktop nav, mobile nav, footer, hero, CTAs)
  // already rely on native smooth scrolling via CSS `scroll-behavior: smooth`.
  // We just make sure the mobile menu closes correctly when a link is used,
  // and guard against empty "#" links breaking navigation.
  document.addEventListener("click", function (e) {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const targetId = link.getAttribute("href");
    if (!targetId || targetId === "#") {
      e.preventDefault();
      return;
    }

    const targetEl = document.querySelector(targetId);
    if (!targetEl) return; // let the browser handle it if section doesn't exist

    // Close the mobile menu whenever a nav link inside it is clicked.
    if (mobileMenu && mobileMenu.contains(link)) {
      closeMobileMenu();
    }
  });

  /* =========================================================
     4. MOBILE MENU
     ========================================================= */
  function openMobileMenu() {
    if (!mobileMenu || !navBurger) return;
    mobileMenu.classList.add("is-open");
    navBurger.setAttribute("aria-expanded", "true");
    navBurger.setAttribute("aria-label", "Close menu");
    document.body.style.overflow = "hidden";
  }

  function closeMobileMenu() {
    if (!mobileMenu || !navBurger) return;
    mobileMenu.classList.remove("is-open");
    navBurger.setAttribute("aria-expanded", "false");
    navBurger.setAttribute("aria-label", "Open menu");
    document.body.style.overflow = "";
  }

  function isMobileMenuOpen() {
    return !!(mobileMenu && mobileMenu.classList.contains("is-open"));
  }

  if (navBurger && mobileMenu) {
    navBurger.addEventListener("click", function () {
      if (isMobileMenuOpen()) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    // Close when clicking outside the menu / burger.
    document.addEventListener("click", function (e) {
      if (!isMobileMenuOpen()) return;
      const clickedInsideMenu = mobileMenu.contains(e.target);
      const clickedBurger = navBurger.contains(e.target);
      if (!clickedInsideMenu && !clickedBurger) {
        closeMobileMenu();
      }
    });

    // Close with Escape.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isMobileMenuOpen()) {
        closeMobileMenu();
        navBurger.focus();
      }
    });

    // Safety: if the viewport is resized up past the mobile breakpoint
    // while the menu is open, close it so it doesn't get stuck.
    window.addEventListener("resize", function () {
      if (window.innerWidth > 760 && isMobileMenuOpen()) {
        closeMobileMenu();
      }
    });
  }

  /* =========================================================
     5. SCROLL REVEALS
     ========================================================= */
  (function initScrollReveal() {
    if (!revealEls.length) return;

    if (prefersReducedMotion) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    if (!("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );

    revealEls.forEach((el) => observer.observe(el));
  })();

  /* =========================================================
     6. MODALS (shared: learning areas, courses, projects)
     ========================================================= */
  let lastFocusedEl = null;

  function openModal(html) {
    if (!modalOverlay || !modalContent) return;

    modalContent.innerHTML = html;
    lastFocusedEl = document.activeElement;

    modalOverlay.classList.add("is-open");
    modalOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (modalClose) {
      modalClose.focus();
    }
  }

  function closeModal() {
    if (!modalOverlay) return;

    modalOverlay.classList.remove("is-open");
    modalOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
      lastFocusedEl.focus();
    }
  }

  function isModalOpen() {
    return !!(modalOverlay && modalOverlay.classList.contains("is-open"));
  }

  if (modalClose) {
    modalClose.addEventListener("click", closeModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener("click", function (e) {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isModalOpen()) {
      closeModal();
    }
  });

  // Small helper: escape text pulled from the DOM before re-inserting it
  // as HTML, so modal content can never break markup.
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  // --- 6a. "What You'll Learn" cards -> modal -------------------------
  // Content is read directly from the existing HTML (the learn card
  // itself, plus the matching course card's skill chips, since both
  // already describe the same discipline). Nothing is invented.
  learnCards.forEach((card) => {
    card.addEventListener("click", function () {
      const key = card.getAttribute("data-panel");
      const title = card.querySelector("h3")
        ? card.querySelector("h3").innerHTML
        : "";
      const desc = card.querySelector("p")
        ? card.querySelector("p").textContent
        : "";

      let skillsHtml = "";
      if (key) {
        const matchingCourse = document.querySelector(
          '[data-course="' + key + '"]'
        );
        if (matchingCourse) {
          const courseCard = matchingCourse.closest(".course-card");
          const skillItems = courseCard
            ? courseCard.querySelectorAll(".course-card__skills li")
            : [];
          if (skillItems.length) {
            skillsHtml =
              '<h4>What You\'ll Practice</h4><ul>' +
              Array.from(skillItems)
                .map((li) => "<li>" + escapeHtml(li.textContent) + "</li>")
                .join("") +
              "</ul>";
          }
        }
      }

      const html =
        '<span class="modal__tag">Learning Area</span>' +
        "<h3>" +
        title +
        "</h3>" +
        "<p>" +
        escapeHtml(desc) +
        "</p>" +
        skillsHtml;

      openModal(html);
    });

    // Keyboard support: cards are native <button> elements, so Enter and
    // Space already trigger "click" — no extra listener needed.
  });

  // --- 6b. Course cards -> modal ---------------------------------------
  courseButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const courseCard = btn.closest(".course-card");
      if (!courseCard) return;

      const title = courseCard.querySelector("h3")
        ? courseCard.querySelector("h3").innerHTML
        : "";
      const desc = courseCard.querySelector(".course-card__body > p")
        ? courseCard.querySelector(".course-card__body > p").textContent
        : "";
      const skillItems = courseCard.querySelectorAll(
        ".course-card__skills li"
      );

      let skillsHtml = "";
      if (skillItems.length) {
        skillsHtml =
          "<h4>Core Skills</h4><ul>" +
          Array.from(skillItems)
            .map((li) => "<li>" + escapeHtml(li.textContent) + "</li>")
            .join("") +
          "</ul>";
      }

      const html =
        '<span class="modal__tag">Course</span>' +
        "<h3>" +
        title +
        "</h3>" +
        "<p>" +
        escapeHtml(desc) +
        "</p>" +
        skillsHtml +
        '<p style="margin-top:18px;"><a class="btn btn--primary btn--sm" href="#contact">Enquire About This Course</a></p>';

      openModal(html);
    });
  });

  // --- 6c. Project / portfolio items -> modal --------------------------
  // Reads whatever is already inside the clicked masonry item (its
  // placeholder label + aspect hint) rather than inventing project data.
  projectButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const labelEl = btn.querySelector(".media-frame__label");
      const hintEl = btn.querySelector(".media-frame__hint");
      const label = labelEl ? labelEl.textContent : "Project";
      const hint = hintEl ? hintEl.textContent : "";

      const html =
        '<span class="modal__tag">Project</span>' +
        "<h3>" +
        escapeHtml(label) +
        "</h3>" +
        "<p>Visuals for this project will be added here as student and studio work becomes available.</p>" +
        (hint
          ? '<div class="modal__media"><div class="media-frame media-frame--16-9"><div class="media-frame__inner"><p class="media-frame__label">' +
            escapeHtml(label) +
            '</p><p class="media-frame__hint">' +
            escapeHtml(hint) +
            "</p></div></div></div>"
          : "");

      openModal(html);
    });
  });

  /* =========================================================
     7. PROCESS / TIMELINE
     ========================================================= */
  (function initProcessTimeline() {
    if (!processLineFill || !processTrack) return;

    if (prefersReducedMotion) {
      processLineFill.classList.add("is-filled");
      return;
    }

    if (!("IntersectionObserver" in window)) {
      processLineFill.classList.add("is-filled");
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            processLineFill.classList.add("is-filled");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    observer.observe(processTrack);
  })();

  /* =========================================================
     8. FAQ (accordion)
     ========================================================= */
  (function initAccordion() {
    if (!accordionItems.length) return;

    accordionItems.forEach((item) => {
      const trigger = item.querySelector(".accordion__trigger");
      const panel = item.querySelector(".accordion__panel");
      if (!trigger || !panel) return;

      // Start closed and accessible.
      trigger.setAttribute("aria-expanded", "false");
      panel.style.maxHeight = "0px";

      trigger.addEventListener("click", function () {
        const isOpen = trigger.getAttribute("aria-expanded") === "true";

        // Close every item first (only one open at a time).
        accordionItems.forEach((otherItem) => {
          const otherTrigger = otherItem.querySelector(".accordion__trigger");
          const otherPanel = otherItem.querySelector(".accordion__panel");
          if (!otherTrigger || !otherPanel) return;
          otherTrigger.setAttribute("aria-expanded", "false");
          otherPanel.style.maxHeight = "0px";
        });

        // Re-open the clicked item if it wasn't already open.
        if (!isOpen) {
          trigger.setAttribute("aria-expanded", "true");
          panel.style.maxHeight = panel.scrollHeight + "px";
        }
      });
    });

    // Keep open panel sized correctly on window resize (text reflow).
    window.addEventListener("resize", function () {
      accordionItems.forEach((item) => {
        const trigger = item.querySelector(".accordion__trigger");
        const panel = item.querySelector(".accordion__panel");
        if (!trigger || !panel) return;
        if (trigger.getAttribute("aria-expanded") === "true") {
          panel.style.maxHeight = panel.scrollHeight + "px";
        }
      });
    });
  })();

  /* =========================================================
     9. FILE UPLOAD (dropzone)
     ========================================================= */
  let selectedFile = null;

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function getFileExtension(name) {
    const idx = name.lastIndexOf(".");
    return idx === -1 ? "" : name.slice(idx).toLowerCase();
  }

  function validateFile(file) {
    const ext = getFileExtension(file.name);
    if (!ALLOWED_FILE_TYPES.includes(ext)) {
      return "Please upload a PDF, JPG, PNG or MP4 file.";
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return "File is too large. Maximum size is " + MAX_FILE_SIZE_MB + "MB.";
    }
    return null;
  }

  function showFileError(message) {
    setFieldError("file", message);
  }

  function clearFileError() {
    setFieldError("file", "");
  }

  function setSelectedFile(file) {
    const error = validateFile(file);
    if (error) {
      showFileError(error);
      resetFileState();
      return;
    }
    clearFileError();
    selectedFile = file;

    if (fileNameEl) {
      fileNameEl.textContent = file.name + " (" + formatFileSize(file.size) + ")";
    }
    if (fileChosen) fileChosen.hidden = false;
    if (dropzone) dropzone.setAttribute("aria-label", "Change uploaded file: " + file.name);
  }

  function resetFileState() {
    selectedFile = null;
    if (fileInput) fileInput.value = "";
    if (fileChosen) fileChosen.hidden = true;
    if (fileNameEl) fileNameEl.textContent = "";
    if (dropzone) {
      dropzone.setAttribute(
        "aria-label",
        "Upload a file: PDF, JPG, PNG or MP4, up to " + MAX_FILE_SIZE_MB + " megabytes"
      );
    }
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", function () {
      fileInput.click();
    });

    dropzone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) {
        setSelectedFile(fileInput.files[0]);
      }
    });

    ["dragenter", "dragover"].forEach((evt) => {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "dragend"].forEach((evt) => {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("is-dragover");
      });
    });

    dropzone.addEventListener("drop", function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("is-dragover");

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        setSelectedFile(file);
        // Keep the native input in sync where the browser allows it.
        try {
          fileInput.files = e.dataTransfer.files;
        } catch (err) {
          /* Some browsers disallow programmatic assignment — safe to ignore. */
        }
      }
    });
  }

  if (fileRemoveBtn) {
    fileRemoveBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      resetFileState();
    });
  }

  /* =========================================================
     10. ENQUIRY FORM / EMAILJS
     ========================================================= */
  const requiredFields = ["fullName", "email", "phone", "interest", "experience", "message"];

  function setFieldError(name, message) {
    const errorEl = enquiryForm
      ? enquiryForm.querySelector('[data-error-for="' + name + '"]')
      : null;
    const fieldEl = errorEl ? errorEl.closest(".field") : null;

    if (errorEl) errorEl.textContent = message || "";
    if (fieldEl) {
      if (message) {
        fieldEl.classList.add("has-error");
      } else {
        fieldEl.classList.remove("has-error");
      }
    }
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isValidPhone(value) {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 7;
  }

  function validateField(name) {
    if (!enquiryForm) return true;
    const field = enquiryForm.elements[name];
    if (!field) return true;

    const value = field.value.trim();

    if (!value) {
      setFieldError(name, "This field is required.");
      return false;
    }

    if (name === "email" && !isValidEmail(value)) {
      setFieldError(name, "Please enter a valid email address.");
      return false;
    }

    if (name === "phone" && !isValidPhone(value)) {
      setFieldError(name, "Please enter a valid phone number.");
      return false;
    }

    setFieldError(name, "");
    return true;
  }

  function validateForm() {
    let isValid = true;
    requiredFields.forEach((name) => {
      const fieldValid = validateField(name);
      if (!fieldValid) isValid = false;
    });

    // File is optional overall, but if one was attempted and rejected,
    // block submission until it's fixed or removed.
    const fileErrorEl = enquiryForm.querySelector('[data-error-for="file"]');
    if (fileErrorEl && fileErrorEl.textContent) {
      isValid = false;
    }

    return isValid;
  }

  function setStatus(message, type) {
    if (!enquiryStatus) return;
    enquiryStatus.textContent = message;
    enquiryStatus.classList.remove("is-success", "is-error", "is-info");
    if (type) enquiryStatus.classList.add(type);
  }

  function setSubmitting(isSubmitting) {
    if (!enquiryForm) return;
    const submitBtn = enquiryForm.querySelector(".enquiry__submit");
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    submitBtn.style.opacity = isSubmitting ? "0.7" : "";
    submitBtn.style.cursor = isSubmitting ? "not-allowed" : "";
  }

  if (enquiryForm) {
    // Live validation as the user leaves each field.
    requiredFields.forEach((name) => {
      const field = enquiryForm.elements[name];
      if (!field) return;
      field.addEventListener("blur", function () {
        validateField(name);
      });
      field.addEventListener("input", function () {
        if (field.closest(".field").classList.contains("has-error")) {
          validateField(name);
        }
      });
    });

    enquiryForm.addEventListener("submit", function (e) {
      e.preventDefault();

      if (!validateForm()) {
        setStatus("Please fix the highlighted fields and try again.", "is-error");
        const firstError = enquiryForm.querySelector(".field.has-error input, .field.has-error select, .field.has-error textarea");
        if (firstError) firstError.focus();
        return;
      }

      setSubmitting(true);
      setStatus("Sending your enquiry…", "is-info");

      const formData = {
        fullName: enquiryForm.elements.fullName.value.trim(),
        email: enquiryForm.elements.email.value.trim(),
        phone: enquiryForm.elements.phone.value.trim(),
        interest: enquiryForm.elements.interest.value,
        experience: enquiryForm.elements.experience.value,
        message: enquiryForm.elements.message.value.trim(),
        fileName: selectedFile ? selectedFile.name : "",
      };

      if (!isEmailJsConfigured()) {
        // Be honest: the form works, but delivery isn't wired up yet.
        setSubmitting(false);
        setStatus(
          "Your enquiry form is ready, but email delivery has not been configured yet.",
          "is-error"
        );
        return;
      }

      if (typeof window.emailjs === "undefined") {
        setSubmitting(false);
        setStatus(
          "Email service failed to load. Please contact us directly using the details on this page.",
          "is-error"
        );
        return;
      }

      window.emailjs
        .send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, formData, EMAILJS_CONFIG.publicKey)
        .then(function () {
          setSubmitting(false);
          setStatus("Thank you — your enquiry has been sent successfully.", "is-success");
          enquiryForm.reset();
          resetFileState();
          requiredFields.forEach((name) => setFieldError(name, ""));
        })
        .catch(function () {
          setSubmitting(false);
          setStatus(
            "Something went wrong while sending your enquiry. Please try again or contact us directly.",
            "is-error"
          );
        });
    });
  }

  /* =========================================================
     11. ACCESSIBILITY / MISC
     ========================================================= */
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* =========================================================
     12. INITIALIZATION
     ========================================================= */
  // Nothing else required — each feature above initializes itself
  // once the DOM references at the top of the file are resolved.
  // This script is loaded with a plain <script src="script.js"> tag
  // at the end of <body>, so the DOM is already available.
})();

/* =========================================================
   COURSE SALES SYSTEM (added module)
   - Rotating course advertisement
   - Course plans / Buy Now
   - 3-step checkout (Course -> Student Details -> Payment)
   - Razorpay integration structure (server-verified)
   Self-contained: does not touch any code above.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     A. CONFIG  — safe for the frontend. NEVER put the Razorpay
     SECRET key here. Only the public Key ID goes in this file.
     The secret lives in backend/.env (see backend/README.md).
     --------------------------------------------------------- */
       const IS_LOCAL = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const API_BASE = IS_LOCAL ? "http://localhost:3000" : "https://am-motion-lab.onrender.com";
  function getStudentToken() {
    try { return localStorage.getItem("amml_token") || ""; } catch (e) { return ""; }
  }
  const PAYMENT_CONFIG = {
    keyId: "rzp_test_TjNiQPSBosqNNi",                    // <-- public Key ID (rzp_test_... / rzp_live_...)
    checkoutEndpoint: API_BASE + "/api/create-order",    // backend: creates the Razorpay order
    verifyEndpoint: API_BASE + "/api/verify-payment",    // backend: verifies the payment signature
    businessName: "AM Motion Lab",
    themeColor: "#2563EB",
    currency: "INR",
    checkoutScriptUrl: "https://checkout.razorpay.com/v1/checkout.js",
  };

  // Certificate details were not supplied, so none are promised here.
  // Replace this sentence once AM Motion Lab confirms certification terms.
  const CERTIFICATE_NOTE =
    "Certificate details for this course will be confirmed by AM Motion Lab at enrolment.";

  const AD_INTERVAL_MS = 6000;

  /* ---------------------------------------------------------
     B. COURSE DATA (prices and durations exactly as supplied)
     --------------------------------------------------------- */
  const LEVEL_ORDER = ["basic", "advanced", "professional"];
  const LEVEL_LABEL = {
    basic: "Basic",
    advanced: "Advanced",
    professional: "Professional / Job-Oriented",
  };

  const SUPPORT = {
    basic: ["Live classes", "Limited doubts", "Basic project feedback"],
    advanced: [
      "Live classes",
      "Regular doubts",
      "Project reviews",
      "WhatsApp support",
      "Portfolio guidance",
    ],
    professional: [
      "Everything in Advanced",
      "Priority doubt support",
      "One-to-one project discussion",
      "WhatsApp support",
      "Phone call support when required",
      "Personal project feedback",
      "Freelancing guidance",
      "Career guidance",
    ],
  };

  const COURSES = {
    "video-editing": {
      name: "Video Editing",
      adHeadline: "Master Video Editing",
      skills: ["Cutting & pacing", "Sound design", "Colour basics"],
      levels: {
        basic: { duration: "3–4 Months", price: 1999 },
        advanced: { duration: "4–5 Months", price: 3999 },
        professional: { duration: "5–6 Months", price: 5999 },
      },
    },
    "2d-animation": {
      name: "2D Animation",
      adHeadline: "Learn 2D Animation",
      skills: ["Animation fundamentals", "Animation principles", "Creative visual production"],
      levels: {
        basic: { duration: "4–5 Months", price: 6999 },
        advanced: { duration: "5–6 Months", price: 9999 },
        professional: { duration: "6–7 Months", price: 13999 },
      },
    },
    "graphic-designing": {
      name: "Graphic Designing",
      adHeadline: "Build Professional Design Skills",
      skills: ["Composition", "Branding basics", "Social creatives"],
      levels: {
        basic: { duration: "3–4 Months", price: 1999 },
        advanced: { duration: "4–5 Months", price: 3999 },
        professional: { duration: "5–6 Months", price: 5999 },
      },
    },
    "motion-graphics": {
      name: "Motion Graphics",
      adHeadline: "Create Professional Motion Graphics",
      skills: ["Keyframe animation", "Typography motion", "Compositing"],
      levels: {
        basic: { duration: "3–4 Months", price: 5999 },
        advanced: { duration: "4–5 Months", price: 7999 },
        professional: { duration: "6–7 Months", price: 11999 },
      },
    },
    "3d-animation": {
      name: "3D Animation",
      adHeadline: "Learn 3D Animation with Maya",
      skills: ["3D workflows", "Modelling & animation concepts", "Rendering concepts"],
      levels: {
        basic: { duration: "5–6 Months", price: 14999 },
        advanced: { duration: "6–7 Months", price: 17999 },
        professional: { duration: "7–8 Months", price: 24999 },
      },
    },
  };

  const COURSE_ORDER = ["video-editing", "2d-animation", "graphic-designing", "motion-graphics", "3d-animation"];
  const AD_ORDER = ["video-editing", "2d-animation", "motion-graphics", "3d-animation", "graphic-designing"];

  // Course features differ by level. Wording is drawn from the existing site
  // copy (fundamentals -> applied project work -> professional workflows).
  function featuresFor(courseId, levelId) {
    const c = COURSES[courseId];
    if (levelId === "basic") {
      return [
        "Fundamentals of " + c.name,
        "Core skills: " + c.skills.join(", "),
        "Practical, project-based learning",
      ];
    }
    if (levelId === "advanced") {
      return [
        "Everything in Basic",
        "Deeper applied practice in " + c.name,
        "Portfolio-focused project work",
      ];
    }
    return [
      "Everything in Advanced",
      "Job-oriented, professional workflows",
      "Industry-focused projects for freelance or career use",
    ];
  }

  function getPlan(courseId, levelId) {
    const c = COURSES[courseId];
    const l = c && c.levels[levelId];
    if (!c || !l) return null;
    return {
      courseId: courseId,
      levelId: levelId,
      course: c.name,
      level: LEVEL_LABEL[levelId],
      duration: l.duration,
      price: l.price,
      features: featuresFor(courseId, levelId),
      support: SUPPORT[levelId],
    };
  }

  /* ---------------------------------------------------------
     C. HELPERS
     --------------------------------------------------------- */
  const reducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }
  function rupees(n) {
    return "\u20B9" + Number(n).toLocaleString("en-IN");
  }
  function startingPrice(courseId) {
    return LEVEL_ORDER.reduce(function (min, lv) {
      return Math.min(min, COURSES[courseId].levels[lv].price);
    }, Infinity);
  }
  function listHtml(items, cls) {
    return '<ul class="' + cls + '">' + items.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
  }
  function byId(id) { return document.getElementById(id); }

  /* ---------------------------------------------------------
     D. PLANS SECTION (course tabs + three level cards)
     --------------------------------------------------------- */
  const plansTabs = byId("plansTabs");
  const plansGrid = byId("plansGrid");
  let planCourse = COURSE_ORDER[0];

  function renderPlans(courseId) {
    if (!plansGrid || !COURSES[courseId]) return;
    planCourse = courseId;

    if (plansTabs) {
      plansTabs.querySelectorAll("[data-plan-course]").forEach(function (tab) {
        const on = tab.getAttribute("data-plan-course") === courseId;
        tab.classList.toggle("is-active", on);
        tab.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    plansGrid.innerHTML = LEVEL_ORDER.map(function (lv) {
      const p = getPlan(courseId, lv);
      return (
        '<article class="plan-card plan-card--' + lv + '">' +
          '<p class="plan-card__level">' + esc(p.level) + "</p>" +
          '<h3 class="plan-card__course">' + esc(p.course) + "</h3>" +
          '<p class="plan-card__price">' + rupees(p.price) + "</p>" +
          '<p class="plan-card__duration">' + esc(p.duration) + "</p>" +
          '<button type="button" class="btn btn--primary plan-card__buy" data-buy-course="' + courseId + '" data-buy-level="' + lv + '">Buy Now</button>' +
          "<h4>What\u2019s included</h4>" + listHtml(p.features, "plan-card__list") +
          "<h4>Support</h4>" + listHtml(p.support, "plan-card__list") +
        "</article>"
      );
    }).join("");
  }

  if (plansTabs) {
    plansTabs.addEventListener("click", function (e) {
      const tab = e.target.closest("[data-plan-course]");
      if (tab) renderPlans(tab.getAttribute("data-plan-course"));
    });
  }
  if (plansGrid) {
    plansGrid.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-buy-course]");
      if (btn) openCheckout(btn.getAttribute("data-buy-course"), btn.getAttribute("data-buy-level"), btn);
    });
    renderPlans(planCourse);
  }

  /* ---------------------------------------------------------
     E. ROTATING COURSE ADVERTISEMENT
     --------------------------------------------------------- */
  (function initAd() {
    const strip = byId("adStrip");
    const slide = byId("adSlide");
    const catEl = byId("adCat");
    const titleEl = byId("adTitle");
    const priceEl = byId("adPrice");
    const cta = byId("adCta");
    const dots = byId("adDots");
    const closeBtn = byId("adClose");
    if (!strip || !slide || !cta) return;

    try {
      if (window.sessionStorage.getItem("amml_ad_dismissed") === "1") {
        strip.hidden = true;
        return;
      }
    } catch (err) { /* storage unavailable — show the banner */ }

    let index = 0;
    let timer = null;
    let swapToken = 0;

    if (dots) {
      dots.innerHTML = AD_ORDER.map(function (id, i) {
        return '<button type="button" class="ad-strip__dot' + (i === 0 ? " is-active" : "") + '" data-ad-index="' + i + '" aria-label="Show ' + esc(COURSES[id].name) + '"></button>';
      }).join("");
    }

    function paint(i) {
      const id = AD_ORDER[i];
      const c = COURSES[id];
      catEl.textContent = c.name;
      titleEl.textContent = c.adHeadline;
      priceEl.textContent = "Starting at " + rupees(startingPrice(id));
      cta.setAttribute("aria-label", "Explore course: " + c.name);
      if (dots) {
        dots.querySelectorAll(".ad-strip__dot").forEach(function (d, di) {
          d.classList.toggle("is-active", di === i);
        });
      }
    }

    function show(i) {
      index = (i + AD_ORDER.length) % AD_ORDER.length;
      const token = ++swapToken;
      if (reducedMotion) { paint(index); return; }
      slide.classList.add("is-swapping");
      window.setTimeout(function () {
        if (token !== swapToken) return;
        paint(index);
        slide.classList.remove("is-swapping");
      }, 400);
    }

    function start() {
      stop();
      timer = window.setInterval(function () { show(index + 1); }, AD_INTERVAL_MS);
    }
    function stop() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    paint(0);
    start();

    // Pause while the visitor is interacting with the banner or the tab is hidden.
    strip.addEventListener("mouseenter", stop);
    strip.addEventListener("mouseleave", start);
    strip.addEventListener("focusin", stop);
    strip.addEventListener("focusout", start);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else if (!strip.hidden) start();
    });

    if (dots) {
      dots.addEventListener("click", function (e) {
        const d = e.target.closest("[data-ad-index]");
        if (!d) return;
        show(parseInt(d.getAttribute("data-ad-index"), 10));
      });
    }

    cta.addEventListener("click", function () {
      openCheckout(AD_ORDER[index], "basic", cta);
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        stop();
        strip.hidden = true;
        try { window.sessionStorage.setItem("amml_ad_dismissed", "1"); } catch (err) { /* ignore */ }
      });
    }
  })();

  /* ---------------------------------------------------------
     F. CHECKOUT (3 steps)
     --------------------------------------------------------- */
  const overlay = byId("checkoutOverlay");
  const closeBtn = byId("checkoutClose");
  const form = byId("checkoutForm");
  const mainView = byId("coMain");
  const resultView = byId("coResult");
  const stepsEl = byId("coSteps");
  const courseSel = byId("coCourse");
  const levelSel = byId("coLevel");
  const summaryEl = byId("coSummary");
  const reviewEl = byId("coReview");
  const statusEl = byId("coStatus");
  const backBtn = byId("coBack");
  const nextBtn = byId("coNext");
  const confirmEl = byId("coConfirm");
  const nameEl = byId("coName");
  const emailEl = byId("coEmail");
  const phoneEl = byId("coPhone");

  const state = { step: 1, course: COURSE_ORDER[0], level: "basic", busy: false, trigger: null };

  function currentPlan() { return getPlan(state.course, state.level); }

  if (courseSel) {
    courseSel.innerHTML = COURSE_ORDER.map(function (id) {
      return '<option value="' + id + '">' + esc(COURSES[id].name) + "</option>";
    }).join("");
  }
  if (levelSel) {
    levelSel.innerHTML = LEVEL_ORDER.map(function (id) {
      return '<option value="' + id + '">' + esc(LEVEL_LABEL[id]) + "</option>";
    }).join("");
  }

  function renderSummary() {
    const p = currentPlan();
    if (!p || !summaryEl) return;
    summaryEl.innerHTML =
      '<div class="co-tiles">' +
        '<div class="co-tile"><span class="co-tile__label">Course</span><strong>' + esc(p.course) + "</strong></div>" +
        '<div class="co-tile"><span class="co-tile__label">Level</span><strong>' + esc(p.level) + "</strong></div>" +
        '<div class="co-tile"><span class="co-tile__label">Duration</span><strong>' + esc(p.duration) + "</strong></div>" +
        '<div class="co-tile co-tile--price"><span class="co-tile__label">Price</span><strong>' + rupees(p.price) + "</strong></div>" +
      "</div>" +
      '<div class="co-cols">' +
        "<div><h4>Course features</h4>" + listHtml(p.features, "co-list") + "</div>" +
        "<div><h4>Support included</h4>" + listHtml(p.support, "co-list") + "</div>" +
      "</div>" +
      '<div class="co-cert"><h4>Certificate</h4><p>' + esc(CERTIFICATE_NOTE) + "</p></div>";
  }

  function normalizePhone(value) {
    let d = String(value).replace(/\D/g, "");
    if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
    return d;
  }

  function renderReview() {
    const p = currentPlan();
    if (!p || !reviewEl) return;
    function row(label, val, cls) {
      return '<div class="co-review__row' + (cls || "") + '"><span>' + label + "</span><strong>" + esc(val) + "</strong></div>";
    }
    reviewEl.innerHTML =
      row("Course", p.course) +
      row("Level", p.level) +
      row("Duration", p.duration) +
      row("Student", nameEl.value.trim()) +
      row("Email", emailEl.value.trim()) +
      row("Phone", normalizePhone(phoneEl.value)) +
      row("Total", rupees(p.price), " co-review__row--total");
  }

  function setStatus(msg, type) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.classList.remove("is-error", "is-info");
    if (type) statusEl.classList.add(type);
  }

  function setFieldError(name, msg) {
    const err = form.querySelector('[data-co-error="' + name + '"]');
    const field = err ? err.closest(".field") : null;
    if (err) err.textContent = msg || "";
    if (field) field.classList.toggle("has-error", !!msg);
  }

  function validateStudent() {
    let ok = true;
    const name = nameEl.value.trim();
    if (name.length < 2 || !/[A-Za-z]/.test(name)) {
      setFieldError("coName", "Please enter the student's full name."); ok = false;
    } else setFieldError("coName", "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
      setFieldError("coEmail", "Please enter a valid email address."); ok = false;
    } else setFieldError("coEmail", "");

    if (!/^[6-9]\d{9}$/.test(normalizePhone(phoneEl.value))) {
      setFieldError("coPhone", "Please enter a valid 10-digit Indian mobile number."); ok = false;
    } else setFieldError("coPhone", "");

    if (!ok) {
      const first = form.querySelector(".field.has-error input");
      if (first) first.focus();
    }
    return ok;
  }

  function setBusy(isBusy, label) {
    state.busy = isBusy;
    nextBtn.disabled = isBusy;
    backBtn.disabled = isBusy;
    if (isBusy && label) nextBtn.textContent = label;
    else updateNav();
  }

  function updateNav() {
    const p = currentPlan();
    backBtn.hidden = state.step === 1;
    if (state.step === 1) nextBtn.textContent = "Continue";
    else if (state.step === 2) nextBtn.textContent = "Continue";
    else nextBtn.textContent = "Proceed to Payment \u00B7 " + rupees(p.price);
  }

  function goToStep(n) {
    state.step = n;
    form.querySelectorAll("[data-co-panel]").forEach(function (panel) {
      panel.hidden = Number(panel.getAttribute("data-co-panel")) !== n;
    });
    stepsEl.querySelectorAll(".steps__item").forEach(function (li, i) {
      li.classList.toggle("is-active", i + 1 === n);
      li.classList.toggle("is-done", i + 1 < n);
      if (i + 1 === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    setStatus("");
    if (n === 3) renderReview();
    updateNav();
    const modalBox = overlay.querySelector(".modal");
    if (modalBox) modalBox.scrollTop = 0;
    const heading = form.querySelector('[data-co-panel="' + n + '"] .co-heading');
    if (heading) heading.focus({ preventScroll: true });
  }

  function syncSelects() {
    courseSel.value = state.course;
    levelSel.value = state.level;
    renderSummary();
  }

  function openCheckout(courseId, levelId, trigger) {
    if (!overlay || !COURSES[courseId]) return;
    if (!getStudentToken()) { location.href = "student/login.html?next=courses"; return; }
    state.course = courseId;
    state.level = LEVEL_ORDER.indexOf(levelId) > -1 ? levelId : "basic";
    state.trigger = trigger || null;
    mainView.hidden = false;
    resultView.hidden = true;
    confirmEl.checked = false;
    syncSelects();
    goToStep(1);
    setBusy(false);

    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function closeCheckout() {
    if (!overlay || state.busy) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (state.trigger && typeof state.trigger.focus === "function") state.trigger.focus();
  }

  if (overlay) {
    closeBtn.addEventListener("click", closeCheckout);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeCheckout(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) closeCheckout();
    });

    courseSel.addEventListener("change", function () {
      state.course = courseSel.value; renderSummary(); updateNav();
    });
    levelSel.addEventListener("change", function () {
      state.level = levelSel.value; renderSummary(); updateNav();
    });

    [nameEl, emailEl, phoneEl].forEach(function (el) {
      el.addEventListener("input", function () {
        if (el.closest(".field").classList.contains("has-error")) validateStudent();
      });
    });

    backBtn.addEventListener("click", function () { if (state.step > 1 && !state.busy) goToStep(state.step - 1); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.busy) return;
      if (state.step === 1) { goToStep(2); return; }
      if (state.step === 2) { if (validateStudent()) goToStep(3); return; }
      startPayment();
    });
  }

  /* ---------------------------------------------------------
     G. PAYMENT (Razorpay Standard Checkout, server-verified)
     Flow:
       1. POST checkoutEndpoint {courseId, levelId, student}
          -> backend computes the price itself and creates the order
       2. Open Razorpay Checkout with the returned order id
       3. On success POST verifyEndpoint with the three Razorpay values
          -> backend checks the signature using the SECRET key
       4. Success is shown ONLY if the backend replies {verified: true}
     --------------------------------------------------------- */
  function isPaymentConfigured() {
    const k = PAYMENT_CONFIG.keyId;
    return typeof k === "string" && k.length > 0 && k.indexOf("YOUR_") !== 0;
  }

  function loadRazorpayScript() {
    return new Promise(function (resolve, reject) {
      if (window.Razorpay) { resolve(); return; }
      const s = document.createElement("script");
      s.src = PAYMENT_CONFIG.checkoutScriptUrl;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("script")); };
      document.head.appendChild(s);
    });
  }

  function postJson(url, body) {
    return fetch(url, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, getStudentToken() ? { Authorization: "Bearer " + getStudentToken() } : {}),
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, data: data };
      });
    });
  }

  function startPayment() {
    const p = currentPlan();
    if (!confirmEl.checked) {
      setStatus("Please confirm that you have reviewed the course details.", "is-error");
      return;
    }
    if (!isPaymentConfigured()) {
      setStatus("Online payment has not been activated yet, so no payment can be taken. Please contact AM Motion Lab to enrol \u2014 details are in the Contact section.", "is-error");
      return;
    }

    const student = {
      name: nameEl.value.trim(),
      email: emailEl.value.trim(),
      phone: normalizePhone(phoneEl.value),
    };

    setBusy(true, "Preparing secure payment\u2026");
    setStatus("Creating your order\u2026", "is-info");

    // The price is NOT sent: the server looks it up from its own catalogue.
    postJson(PAYMENT_CONFIG.checkoutEndpoint, { courseId: p.courseId, levelId: p.levelId, student: student })
      .then(function (r) {
        const order = r.data;
        if (!r.ok || !order || !order.orderId) throw new Error("order");
        if (Number(order.amount) !== p.price * 100 || order.currency !== PAYMENT_CONFIG.currency) throw new Error("amount");
        return loadRazorpayScript().then(function () { return order; });
      })
      .then(function (order) { openRazorpay(order, p, student); })
      .catch(function () {
        setBusy(false);
        setStatus("We couldn\u2019t start the payment right now. Nothing has been charged. Please try again, or contact AM Motion Lab to enrol.", "is-error");
      });
  }

  function openRazorpay(order, p, student) {
    const rzp = new window.Razorpay({
      key: PAYMENT_CONFIG.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: PAYMENT_CONFIG.businessName,
      description: p.course + " \u2014 " + p.level,
      prefill: { name: student.name, email: student.email, contact: "+91" + student.phone },
      notes: { course: p.course, level: p.level },
      theme: { color: PAYMENT_CONFIG.themeColor },
      modal: {
        ondismiss: function () {
          setBusy(false);
          setStatus("Payment window closed. No payment was completed.", "is-info");
        },
      },
      handler: function (resp) { verifyPayment(resp, p); },
    });
    rzp.on("payment.failed", function (ev) {
      setBusy(false);
      const d = ev && ev.error && ev.error.description;
      setStatus((d ? d + " " : "") + "Payment was not completed. You can try again.", "is-error");
    });
    setStatus("Complete the payment in the secure payment window.", "is-info");
    rzp.open();
  }

  function verifyPayment(resp, p) {
    setBusy(true, "Verifying payment\u2026");
    setStatus("Verifying your payment\u2026 please don\u2019t close this window.", "is-info");

    postJson(PAYMENT_CONFIG.verifyEndpoint, {
      razorpay_order_id: resp.razorpay_order_id,
      razorpay_payment_id: resp.razorpay_payment_id,
      razorpay_signature: resp.razorpay_signature,
    })
      .then(function (r) {
        if (r.ok && r.data && r.data.verified === true) showResult(true, p, resp.razorpay_payment_id);
        else showResult(false, p, resp.razorpay_payment_id);
      })
      .catch(function () { showResult(false, p, resp.razorpay_payment_id); });
  }

  function showResult(success, p, paymentId) {
    state.busy = false;
    mainView.hidden = true;
    resultView.hidden = false;
    const okIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const warnIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 7v6M12 17h.01"/></svg>';
    resultView.innerHTML = success
      ? '<div class="co-result__icon co-result__icon--ok">' + okIcon + "</div>" +
        "<h3>Payment verified</h3>" +
        "<p>Your payment for <strong>" + esc(p.course) + " \u2014 " + esc(p.level) + "</strong> has been verified.</p>" +
        '<span class="co-result__ref">Payment ID: ' + esc(paymentId) + "</span><br>" +
        '<button type="button" class="btn btn--primary" id="coDone">Done</button>'
      : '<div class="co-result__icon co-result__icon--warn">' + warnIcon + "</div>" +
        "<h3>We couldn\u2019t verify your payment</h3>" +
        "<p>Your payment could not be confirmed automatically. If money was deducted, please contact AM Motion Lab with the payment ID below \u2014 do not pay again.</p>" +
        '<span class="co-result__ref">Payment ID: ' + esc(paymentId) + "</span><br>" +
        '<button type="button" class="btn btn--ghost" id="coDone">Close</button>';
    const done = byId("coDone");
    if (done) done.addEventListener("click", function () { if (success) { location.href = "student/dashboard.html"; } else { closeCheckout(); } });
    if (done) done.focus();
  }
})();