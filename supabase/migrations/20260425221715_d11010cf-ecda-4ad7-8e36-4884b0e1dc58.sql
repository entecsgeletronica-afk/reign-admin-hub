ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS youtube_settings jsonb NOT NULL DEFAULT jsonb_build_object(
    'whiteLabelMode', true,
    'showControls', true,
    'hideRelated', true,
    'hideAnnotations', true,
    'disableKeyboard', true,
    'customPlayButton', true,
    'hideInitialBottomBar', true
  );