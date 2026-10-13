const LEVELS = {
  basic: { name: "Basic", lessonCount: 6 },
  advanced: { name: "Advanced", lessonCount: 9 },
  professional: { name: "Professional / Job-Oriented", lessonCount: 12 },
};

const COURSE_DATA = {
  "video-editing": {
    name: "Video Editing",
    overview: "Build a complete editing workflow, from raw footage to a polished export.",
    lessons: [
      ["Editing workspace", "Set up a project, organise media, and understand the editing interface."],
      ["Footage and project setup", "Choose settings, import footage, and keep project files organised."],
      ["The timeline", "Use tracks, trims, ripple edits, and precise timeline navigation."],
      ["Clean cuts and continuity", "Create clear edits that preserve visual and audio continuity."],
      ["Story and pacing", "Shape a sequence with purposeful rhythm, emphasis, and transitions."],
      ["Working with music", "Edit to a beat and balance music with dialogue and effects."],
      ["Sound design", "Clean dialogue and layer effects for a clear, immersive mix."],
      ["Colour correction", "Balance exposure and colour before applying a consistent look."],
      ["Titles and graphics", "Add readable titles and motion elements that support the story."],
      ["Social formats", "Adapt a project for vertical, square, and widescreen delivery."],
      ["Export and quality control", "Choose delivery settings and check the final file."],
      ["Final edit project", "Plan, edit, mix, grade, and export a complete short-form video."],
    ],
  },
  "2d-animation": {
    name: "2D Animation",
    overview: "Develop animation fundamentals and apply them to a finished 2D sequence.",
    lessons: [
      ["Animation workspace", "Set up a scene, timeline, frame rate, and drawing workflow."],
      ["Timing and spacing", "Control motion speed and weight through frame spacing."],
      ["Squash, stretch, and anticipation", "Use core principles to make movement feel clear and alive."],
      ["Key poses and breakdowns", "Plan readable poses and connect them with strong breakdowns."],
      ["Arcs and follow-through", "Create natural paths, overlap, and secondary movement."],
      ["Walk cycle", "Construct a balanced walk with contact, passing, and recovery poses."],
      ["Acting and expression", "Communicate a character's intention through pose and expression."],
      ["Clean-up and consistency", "Refine drawings while preserving volume and line quality."],
      ["Lip sync and dialogue", "Match mouth shapes and body performance to spoken audio."],
      ["Backgrounds and camera", "Compose a scene and use camera movement to guide attention."],
      ["Compositing and sound", "Combine layers and audio into a finished scene."],
      ["Final animation", "Produce and export a complete, polished 2D animation."],
    ],
  },
  "graphic-designing": {
    name: "Graphic Designing",
    overview: "Apply visual design principles to a consistent identity and portfolio-ready work.",
    lessons: [
      ["Design foundations", "Use hierarchy, alignment, contrast, balance, and spacing."],
      ["Colour systems", "Build purposeful palettes and maintain accessible contrast."],
      ["Typography", "Pair typefaces and create clear typographic hierarchy."],
      ["Composition and grids", "Structure layouts with grids, scale, and visual rhythm."],
      ["Image editing", "Prepare and refine images for clean, consistent design work."],
      ["Brand strategy", "Translate an audience and brand brief into visual direction."],
      ["Logo development", "Explore concepts and refine a flexible logo system."],
      ["Brand identity", "Apply identity elements consistently across brand touchpoints."],
      ["Social media design", "Create a reusable set of on-brand social graphics."],
      ["Print-ready artwork", "Prepare layouts, colour, and exports for print production."],
      ["Presentation and feedback", "Present design decisions and refine work from critique."],
      ["Final brand project", "Deliver a cohesive identity and a polished portfolio case study."],
    ],
  },
  "motion-graphics": {
    name: "Motion Graphics",
    overview: "Design and animate clear visual sequences using type, shape, timing, and compositing.",
    lessons: [
      ["Motion design workspace", "Set up compositions, frame rates, and an organised project."],
      ["Keyframes and timing", "Animate properties with deliberate timing and easing."],
      ["The graph editor", "Shape acceleration and deceleration for controlled movement."],
      ["Shape layers and paths", "Build and animate clean vector forms and transitions."],
      ["Typography in motion", "Animate type while preserving readability and hierarchy."],
      ["Transitions and rhythm", "Connect scenes with transitions that support the message."],
      ["Masks and compositing", "Combine layers, mattes, and effects into a coherent shot."],
      ["3D space and cameras", "Arrange layers in depth and create purposeful camera moves."],
      ["Sound and polish", "Use audio cues and finishing details to strengthen a sequence."],
      ["Reusable systems", "Create adaptable layouts and animation presets for a campaign."],
      ["Render and delivery", "Export reliable versions for social and presentation formats."],
      ["Final motion project", "Design and deliver a polished motion-graphics sequence."],
    ],
  },
  "3d-animation": {
    name: "3D Animation",
    overview: "Move from 3D fundamentals to a lit, animated, and rendered final scene.",
    lessons: [
      ["Maya workspace", "Navigate the interface, viewport, and scene organisation."],
      ["Modelling fundamentals", "Build clean forms with core polygon modelling tools."],
      ["Topology and refinement", "Refine geometry for clean shading and dependable deformation."],
      ["UVs and materials", "Prepare UVs and create readable, consistent materials."],
      ["Lighting and composition", "Light a scene and guide the viewer's attention."],
      ["Rigging fundamentals", "Understand controls, hierarchy, and basic character setup."],
      ["Keyframe animation", "Pose and animate objects with clear timing and spacing."],
      ["Character motion", "Apply weight, arcs, and overlap to a short character action."],
      ["Camera and staging", "Frame action and use camera choices to clarify the scene."],
      ["Rendering workflow", "Set render quality, output settings, and review passes."],
      ["Compositing and delivery", "Make final adjustments and prepare reliable deliverables."],
      ["Final 3D animation", "Model, animate, light, and render a complete short sequence."],
    ],
  },
};

const COURSES = Object.fromEntries(Object.entries(COURSE_DATA).map(([id, course]) => [
  id,
  {
    ...course,
    levels: LEVELS,
    lessons: course.lessons.map(([title, outcome], index) => ({
      id: "lesson-" + String(index + 1).padStart(2, "0"),
      module: "Module " + String(Math.floor(index / 3) + 1).padStart(2, "0"),
      title,
      outcome,
    })),
  },
]));

const LEVEL_RANK = { basic: 1, advanced: 2, professional: 3 };

module.exports = { COURSES, LEVEL_RANK };