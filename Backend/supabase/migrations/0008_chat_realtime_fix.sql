-- 0008_chat_realtime_fix.sql
-- Supabase Realtime validates a postgres_changes filter column against the subscriber's
-- column privileges, so "event: UPDATE ... filter course_id=eq.<id>" failed with
-- "invalid column for filter course_id" while only deleted_at was updatable.
--
-- Fix: allow UPDATE privilege on course_id as well, and make the trigger force every
-- column except deleted_at back to its old value. The privilege can therefore never be
-- used to move a message to another course or to impersonate another sender.

grant update (course_id) on chat_messages to authenticated;

create or replace function chat_guard() returns trigger
    language plpgsql security definer set search_path = public as
$$
begin
    if tg_op = 'INSERT' then
        if auth.uid() is not null and (
            select count(*) from chat_messages
            where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
            raise exception 'You are sending messages too fast. Please wait a moment.';
        end if;
        new.body := btrim(new.body);
        return new;
    end if;

    -- UPDATE: the only legitimate change is a soft delete.
    new.course_id := old.course_id;
    new.sender_id := old.sender_id;
    new.created_at := old.created_at;
    if new.deleted_at is not null and old.deleted_at is null then
        new.body := '[deleted]';
    else
        new.deleted_at := old.deleted_at;
        new.body := old.body;
    end if;
    return new;
end $$;
