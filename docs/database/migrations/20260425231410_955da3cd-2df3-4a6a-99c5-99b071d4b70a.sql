UPDATE public.protected_settings
   SET value = ''
 WHERE key IN (
   'sidebar_footer_enabled',
   'sidebar_footer_text',
   'sidebar_footer_copyright',
   'community_url',
   'community_label'
 );