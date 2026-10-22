-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabel questions
CREATE TABLE questions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    grade int CHECK (grade BETWEEN 1 AND 6),
    topic text,
    body text,
    option_a text,
    option_b text,
    option_c text,
    option_d text,
    correct char(1) CHECK (correct IN ('A', 'B', 'C', 'D')),
    explanation text
);

-- 2. Tabel attempts
CREATE TABLE attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_name text,
    grade int,
    question_ids bigint[],
    duration_seconds int,
    started_at timestamptz DEFAULT now(),
    submitted_at timestamptz,
    score numeric
);

-- 3. Tabel attempt_answers
CREATE TABLE attempt_answers (
    attempt_id uuid REFERENCES attempts(id) ON DELETE CASCADE,
    question_id bigint,
    chosen char(1),
    flagged boolean DEFAULT false,
    PRIMARY KEY (attempt_id, question_id)
);

-- Aktifkan RLS di ketiga tabel
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_answers ENABLE ROW LEVEL SECURITY;

-- JANGAN buat policy apa pun. Akses hanya lewat RPC.

-- FUNGSI 1: start_attempt
CREATE OR REPLACE FUNCTION start_attempt(p_name text, p_grade int, p_count int DEFAULT 30, p_duration int DEFAULT 5400)
RETURNS uuid AS $$
DECLARE
    v_attempt_id uuid;
    v_q_ids bigint[];
BEGIN
    SELECT array_agg(id) INTO v_q_ids FROM (
        SELECT id FROM questions WHERE grade = p_grade ORDER BY random() LIMIT p_count
    ) sub;
    
    INSERT INTO attempts (participant_name, grade, question_ids, duration_seconds)
    VALUES (p_name, p_grade, v_q_ids, p_duration) 
    RETURNING id INTO v_attempt_id;
    
    RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION start_attempt(text, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_attempt(text, int, int, int) TO anon;

-- FUNGSI 2: get_attempt
CREATE OR REPLACE FUNCTION get_attempt(p_attempt uuid)
RETURNS json AS $$
DECLARE
    v_result json;
BEGIN
    SELECT json_build_object(
        'participant_name', a.participant_name,
        'grade', a.grade,
        'started_at', a.started_at,
        'deadline', a.started_at + (a.duration_seconds || ' seconds')::interval,
        'server_now', now(),
        'submitted', a.submitted_at IS NOT NULL,
        'question_ids', a.question_ids,
        'questions', (
            SELECT json_agg(json_build_object(
                'id', q.id,
                'body', q.body,
                'option_a', q.option_a,
                'option_b', q.option_b,
                'option_c', q.option_c,
                'option_d', q.option_d
            ) ORDER BY array_position(a.question_ids, q.id))
            FROM questions q
            WHERE q.id = ANY(a.question_ids)
        ),
        'answers', (
            SELECT json_agg(json_build_object(
                'question_id', aa.question_id,
                'chosen', aa.chosen,
                'flagged', aa.flagged
            ))
            FROM attempt_answers aa
            WHERE aa.attempt_id = a.id
        )
    ) INTO v_result
    FROM attempts a WHERE a.id = p_attempt;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_attempt(uuid) TO anon;

-- FUNGSI 3: save_answer
CREATE OR REPLACE FUNCTION save_answer(p_attempt uuid, p_question bigint, p_chosen char(1), p_flagged boolean)
RETURNS void AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM attempts
        WHERE id = p_attempt AND (submitted_at IS NOT NULL OR now() > started_at + (duration_seconds || ' seconds')::interval)
    ) THEN
        RAISE EXCEPTION 'Attempt already submitted or expired';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM attempts WHERE id = p_attempt AND p_question = ANY(question_ids)
    ) THEN
        RAISE EXCEPTION 'Question not in this attempt';
    END IF;
    
    INSERT INTO attempt_answers (attempt_id, question_id, chosen, flagged)
    VALUES (p_attempt, p_question, p_chosen, p_flagged)
    ON CONFLICT (attempt_id, question_id) DO UPDATE
    SET chosen = EXCLUDED.chosen, flagged = EXCLUDED.flagged;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION save_answer(uuid, bigint, char, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_answer(uuid, bigint, char, boolean) TO anon;

-- FUNGSI 4: submit_attempt
CREATE OR REPLACE FUNCTION submit_attempt(p_attempt uuid)
RETURNS numeric AS $$
DECLARE
    v_score numeric;
    v_total int;
    v_correct int;
BEGIN
    IF EXISTS (SELECT 1 FROM attempts WHERE id = p_attempt AND submitted_at IS NOT NULL) THEN
        SELECT score INTO v_score FROM attempts WHERE id = p_attempt;
        RETURN v_score;
    END IF;

    SELECT array_length(question_ids, 1) INTO v_total FROM attempts WHERE id = p_attempt;
    
    IF v_total IS NULL OR v_total = 0 THEN
        RETURN 0;
    END IF;

    SELECT count(*) INTO v_correct
    FROM attempt_answers aa
    JOIN questions q ON aa.question_id = q.id
    WHERE aa.attempt_id = p_attempt AND aa.chosen = q.correct;

    v_score := ROUND((v_correct::numeric / v_total::numeric) * 100, 2);

    UPDATE attempts
    SET submitted_at = now(), score = v_score
    WHERE id = p_attempt;

    RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION submit_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_attempt(uuid) TO anon;

-- FUNGSI 5: get_result
CREATE OR REPLACE FUNCTION get_result(p_attempt uuid)
RETURNS json AS $$
DECLARE
    v_result json;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM attempts WHERE id = p_attempt AND submitted_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Attempt not submitted yet';
    END IF;

    SELECT json_build_object(
        'score', a.score,
        'details', (
            SELECT json_agg(json_build_object(
                'index', array_position(a.question_ids, q.id),
                'topic', q.topic,
                'body', q.body,
                'option_a', q.option_a,
                'option_b', q.option_b,
                'option_c', q.option_c,
                'option_d', q.option_d,
                'chosen', aa.chosen,
                'correct', q.correct,
                'explanation', q.explanation
            ) ORDER BY array_position(a.question_ids, q.id))
            FROM questions q
            LEFT JOIN attempt_answers aa ON q.id = aa.question_id AND aa.attempt_id = a.id
            WHERE q.id = ANY(a.question_ids)
        )
    ) INTO v_result
    FROM attempts a WHERE a.id = p_attempt;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_result(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_result(uuid) TO anon;