-- 0004_storage.sql
-- Private buckets + storage policies (spec Section 5). Files are only ever served
-- through signed URLs (60 min). Size and MIME limits are also enforced here, in
-- addition to the validation done in the server actions.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('resources', 'resources', false, 52428800, array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png', 'image/jpeg', 'video/mp4', 'application/zip', 'application/x-zip-compressed']),
  ('submissions', 'submissions', false, 26214400, array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png', 'image/jpeg', 'application/zip', 'application/x-zip-compressed']),
  ('avatars', 'avatars', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;

create function can_submit_assignment(aid uuid) returns boolean
    language sql stable security definer set search_path = public as
$$ select exists (select 1 from assignments
                  where id = aid and is_published and (now() <= due_at or allow_late)) $$;

-- RESOURCES: {course_id}/{uuid}-{filename}
create policy resources_obj_read on storage.objects for select to authenticated
    using (bucket_id = 'resources'
           and can_access_course(safe_uuid((storage.foldername(name))[1])));
create policy resources_obj_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'resources'
           and (is_admin() or teaches_course(safe_uuid((storage.foldername(name))[1]))));
create policy resources_obj_update on storage.objects for update to authenticated
    using (bucket_id = 'resources'
           and (is_admin() or teaches_course(safe_uuid((storage.foldername(name))[1]))));
create policy resources_obj_delete on storage.objects for delete to authenticated
    using (bucket_id = 'resources'
           and (is_admin() or teaches_course(safe_uuid((storage.foldername(name))[1]))));

-- SUBMISSIONS: {assignment_id}/{student_id}/{uuid}-{filename}
create policy submissions_obj_read on storage.objects for select to authenticated
    using (bucket_id = 'submissions' and (
           safe_uuid((storage.foldername(name))[2]) = auth.uid()
        or is_admin()
        or teaches_course(assignment_course(safe_uuid((storage.foldername(name))[1])))));
create policy submissions_obj_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'submissions'
        and safe_uuid((storage.foldername(name))[2]) = auth.uid()
        and enrolled_in(assignment_course(safe_uuid((storage.foldername(name))[1])))
        and can_submit_assignment(safe_uuid((storage.foldername(name))[1])));
create policy submissions_obj_delete on storage.objects for delete to authenticated
    using (bucket_id = 'submissions' and (
           safe_uuid((storage.foldername(name))[2]) = auth.uid()
        or is_admin()
        or teaches_course(assignment_course(safe_uuid((storage.foldername(name))[1])))));

-- AVATARS: {user_id}.{ext}  (any signed-in user reads, only the owner writes)
create policy avatars_obj_read on storage.objects for select to authenticated
    using (bucket_id = 'avatars' and auth_role() is not null);
create policy avatars_obj_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and name like auth.uid()::text || '.%');
create policy avatars_obj_update on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and name like auth.uid()::text || '.%');
create policy avatars_obj_delete on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and name like auth.uid()::text || '.%');
