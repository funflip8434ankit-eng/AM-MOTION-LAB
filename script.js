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
emailjs.send("service_664qy7f","template_pbirglk");
