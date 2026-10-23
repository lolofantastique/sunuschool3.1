-- ================================================================
--  SunuSchool — schéma Supabase complet avec multi-école
--  À exécuter dans : Supabase Dashboard → SQL Editor
--  ⚠️  Exécutez dans CET ORDRE, section par section.
-- ================================================================

-- ============================================================
-- SECTION 1 : EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SECTION 2 : TABLE DES ÉCOLES (multi-école)
-- ============================================================
CREATE TABLE IF NOT EXISTS schools (
  id            BIGSERIAL   PRIMARY KEY,
  slug          TEXT        UNIQUE,                   -- ex: 'al-amine-touba'
  name          TEXT        NOT NULL,                 -- Nom complet
  short_name    TEXT,                                 -- Nom court
  city          TEXT,
  phone         TEXT,
  email         TEXT,
  ia            TEXT,                                 -- Inspection Académique
  ief           TEXT,                                 -- IEF
  school_year   TEXT        DEFAULT '2025 - 2026',
  logo          TEXT,                                 -- URL du logo
  currency      TEXT        DEFAULT 'FCFA',
  country       TEXT        DEFAULT 'Sénégal',
  is_active     BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Si la table schools existait déjà auparavant sans certaines colonnes, on les ajoute :
ALTER TABLE schools ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS short_name TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS ia TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS ief TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2025 - 2026';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'FCFA';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Sénégal';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Index unique garanti sur le slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_slug ON schools(slug);

-- ============================================================
-- SECTION 3 : PROFILS UTILISATEURS (liés à Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   BIGINT      REFERENCES schools(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  matricule   TEXT        NOT NULL,
  full_name   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, matricule)
);

-- ============================================================
-- SECTION 4 : CLASSES
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
  id              BIGSERIAL   PRIMARY KEY,
  school_id       BIGINT      NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  level           TEXT        NOT NULL CHECK (level IN ('Primaire', 'Collège', 'Lycée')),
  room            TEXT,
  head_teacher_id BIGINT,     -- FK vers teachers, ajoutée après
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- ============================================================
-- SECTION 5 : ENSEIGNANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
  id          BIGSERIAL   PRIMARY KEY,
  school_id   BIGINT      NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  matricule   TEXT        NOT NULL,
  full_name   TEXT        NOT NULL,
  subject     TEXT        NOT NULL,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, matricule)
);

-- Coefficient de la matière par enseignant
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS coeff NUMERIC(4,2) DEFAULT 1.0;

-- Maintenant on peut ajouter la FK head_teacher_id sur classes
ALTER TABLE classes DROP CONSTRAINT IF EXISTS fk_head_teacher;
ALTER TABLE classes ADD CONSTRAINT fk_head_teacher
  FOREIGN KEY (head_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
  NOT VALID;

-- ============================================================
-- SECTION 6 : CRÉNEAUX (emplois du temps)
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_slots (
  id          BIGSERIAL   PRIMARY KEY,
  school_id   BIGINT      NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id  BIGINT      NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_id    BIGINT      NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day         TEXT        NOT NULL CHECK (day IN ('Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam')),
  start_time  TIME        NOT NULL,
  end_time    TIME        NOT NULL,
  room        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 7 : MATIÈRES
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id          BIGSERIAL   PRIMARY KEY,
  school_id   BIGINT      NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  coeff       NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  teacher_id  BIGINT      REFERENCES teachers(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- ============================================================
-- SECTION 8 : ÉLÈVES
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id            BIGSERIAL   PRIMARY KEY,
  school_id     BIGINT      NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id      BIGINT      REFERENCES classes(id) ON DELETE SET NULL,
  full_name     TEXT        NOT NULL,
  matricule     TEXT        NOT NULL,
  sex           TEXT        CHECK (sex IN ('M', 'F')),
  dob           DATE,
  parent_name   TEXT,
  phone         TEXT,
  monthly_fee   INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, matricule)
);

-- Vue pratique : élève avec le nom de sa classe
CREATE OR REPLACE VIEW students_with_class AS
  SELECT s.*, c.name AS classe, c.level, c.room
  FROM students s
  LEFT JOIN classes c ON c.id = s.class_id;

-- ============================================================
-- SECTION 9 : NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS grades (
  id          BIGSERIAL   PRIMARY KEY,
  school_id   BIGINT      NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  BIGINT      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id  BIGINT      NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  semester    TEXT        NOT NULL CHECK (semester IN ('S1', 'S2')),
  d1          NUMERIC(5,2),
  d2          NUMERIC(5,2),
  compo       NUMERIC(5,2),
  average     NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN d1 IS NOT NULL AND d2 IS NOT NULL AND compo IS NOT NULL
    THEN ROUND((d1 + d2 + compo * 2) / 4.0, 2) ELSE NULL END
  ) STORED,
  updated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, student_id, subject_id, semester)
);

-- ============================================================
-- SECTION 10 : ABSENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id            BIGSERIAL   PRIMARY KEY,
  school_id     BIGINT      NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id    BIGINT      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id      BIGINT      NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day           DATE        NOT NULL,
  status        TEXT        NOT NULL CHECK (status IN ('A', 'J', 'R')),
  minutes_late  INTEGER     DEFAULT 0,
  reason        TEXT,
  recorded_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, student_id, day)
);

-- ============================================================
-- SECTION 11 : PAIEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id            BIGSERIAL   PRIMARY KEY,
  school_id     BIGINT      NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id    BIGINT      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  receipt_no    TEXT        NOT NULL,
  month         TEXT        NOT NULL,
  amount        INTEGER     NOT NULL CHECK (amount > 0),
  method        TEXT        NOT NULL DEFAULT 'Espèces',
  reference     TEXT,
  paid_on       DATE        NOT NULL DEFAULT CURRENT_DATE,
  recorded_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, receipt_no)
);

-- ============================================================
-- SECTION 12 : ROW LEVEL SECURITY (RLS)
-- Chaque utilisateur ne voit que les données de son école.
-- ============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE schools      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE students     ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments     ENABLE ROW LEVEL SECURITY;

-- Suppression préalable pour permettre le changement de type (ex: passage à UUID)
DROP FUNCTION IF EXISTS my_school_id() CASCADE;
DROP FUNCTION IF EXISTS my_role() CASCADE;
DROP FUNCTION IF EXISTS my_matricule() CASCADE;

-- Fonction helper : renvoie l'ID de l'école de l'utilisateur connecté
CREATE OR REPLACE FUNCTION my_school_id()
RETURNS BIGINT LANGUAGE sql STABLE AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid()
$$;

-- Fonction helper : renvoie le rôle de l'utilisateur connecté
CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Fonction helper : renvoie le matricule de l'utilisateur connecté
CREATE OR REPLACE FUNCTION my_matricule()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT matricule FROM profiles WHERE id = auth.uid()
$$;

-- Valeur par défaut automatique pour school_id sur toutes les tables
-- (Évite d'avoir à spécifier manuellement school_id lors des insertions)
ALTER TABLE classes       ALTER COLUMN school_id SET DEFAULT my_school_id();
ALTER TABLE teachers      ALTER COLUMN school_id SET DEFAULT my_school_id();
ALTER TABLE teacher_slots ALTER COLUMN school_id SET DEFAULT my_school_id();
ALTER TABLE subjects      ALTER COLUMN school_id SET DEFAULT my_school_id();
ALTER TABLE students      ALTER COLUMN school_id SET DEFAULT my_school_id();
ALTER TABLE grades        ALTER COLUMN school_id SET DEFAULT my_school_id();
ALTER TABLE attendance    ALTER COLUMN school_id SET DEFAULT my_school_id();
ALTER TABLE payments      ALTER COLUMN school_id SET DEFAULT my_school_id();

-- Politique : schools — lecture publique par slug (page de login, détection dynamique)
DROP POLICY IF EXISTS "schools_select" ON schools;
CREATE POLICY "schools_select" ON schools FOR SELECT USING (true);

-- Politique : schools — mise à jour autorisée uniquement par l'admin de l'école
DROP POLICY IF EXISTS "schools_admin_update" ON schools;
CREATE POLICY "schools_admin_update" ON schools FOR UPDATE USING (id = my_school_id() AND my_role() = 'admin');

-- Politique : profiles — chaque utilisateur lit son profil, et TOUS les administrateurs voient les profils de leur école
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  id = auth.uid() OR (school_id = my_school_id() AND my_role() = 'admin')
);

-- Politique : profiles — les administrateurs peuvent gérer les profils de leur école
DROP POLICY IF EXISTS "profiles_admin_write" ON profiles;
CREATE POLICY "profiles_admin_write" ON profiles FOR ALL USING (
  school_id = my_school_id() AND my_role() = 'admin'
) WITH CHECK (
  school_id = my_school_id() AND my_role() = 'admin'
);

-- Politique générale : utilisateurs lisent les données de LEUR école
DROP POLICY IF EXISTS "classes_select" ON classes;
CREATE POLICY "classes_select"       ON classes       FOR SELECT USING (school_id = my_school_id());
DROP POLICY IF EXISTS "teachers_select" ON teachers;
CREATE POLICY "teachers_select"      ON teachers      FOR SELECT USING (school_id = my_school_id());
DROP POLICY IF EXISTS "teacher_slots_select" ON teacher_slots;
CREATE POLICY "teacher_slots_select" ON teacher_slots FOR SELECT USING (school_id = my_school_id());
DROP POLICY IF EXISTS "subjects_select" ON subjects;
CREATE POLICY "subjects_select"      ON subjects      FOR SELECT USING (school_id = my_school_id());
DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select"      ON payments      FOR SELECT USING (school_id = my_school_id());

-- Élèves : admin voit tous, enseignant voit ses classes, élève voit seulement lui-même
DROP POLICY IF EXISTS "students_select" ON students;
CREATE POLICY "students_select" ON students FOR SELECT USING (
  school_id = my_school_id() AND (
    my_role() IN ('admin', 'teacher')
    OR matricule = my_matricule()
  )
);

-- Notes : admin/enseignant voient tout, élève voit seulement les siennes
DROP POLICY IF EXISTS "grades_select" ON grades;
CREATE POLICY "grades_select" ON grades FOR SELECT USING (
  school_id = my_school_id() AND (
    my_role() IN ('admin', 'teacher')
    OR student_id IN (SELECT id FROM students WHERE matricule = my_matricule() AND school_id = my_school_id())
  )
);

-- Absences : admin voit tout, enseignant voit ses classes, élève voit les siennes
DROP POLICY IF EXISTS "attendance_select" ON attendance;
CREATE POLICY "attendance_select" ON attendance FOR SELECT USING (
  school_id = my_school_id() AND (
    my_role() IN ('admin', 'teacher')
    OR student_id IN (SELECT id FROM students WHERE matricule = my_matricule() AND school_id = my_school_id())
  )
);

-- Politiques d'écriture : TOUS les administrateurs de l'école peuvent tout modifier (classes, profs, élèves, créneaux, matières, paiements)
DROP POLICY IF EXISTS "classes_admin" ON classes;
CREATE POLICY "classes_admin"       ON classes       FOR ALL USING (school_id = my_school_id() AND my_role() = 'admin') WITH CHECK (school_id = my_school_id() AND my_role() = 'admin');
DROP POLICY IF EXISTS "teachers_admin" ON teachers;
CREATE POLICY "teachers_admin"      ON teachers      FOR ALL USING (school_id = my_school_id() AND my_role() = 'admin') WITH CHECK (school_id = my_school_id() AND my_role() = 'admin');
DROP POLICY IF EXISTS "teacher_slots_admin" ON teacher_slots;
CREATE POLICY "teacher_slots_admin" ON teacher_slots FOR ALL USING (school_id = my_school_id() AND my_role() = 'admin') WITH CHECK (school_id = my_school_id() AND my_role() = 'admin');
DROP POLICY IF EXISTS "subjects_admin" ON subjects;
CREATE POLICY "subjects_admin"      ON subjects      FOR ALL USING (school_id = my_school_id() AND my_role() = 'admin') WITH CHECK (school_id = my_school_id() AND my_role() = 'admin');
DROP POLICY IF EXISTS "students_admin" ON students;
CREATE POLICY "students_admin"      ON students      FOR ALL USING (school_id = my_school_id() AND my_role() = 'admin') WITH CHECK (school_id = my_school_id() AND my_role() = 'admin');
DROP POLICY IF EXISTS "payments_admin" ON payments;
CREATE POLICY "payments_admin"      ON payments      FOR ALL USING (school_id = my_school_id() AND my_role() = 'admin') WITH CHECK (school_id = my_school_id() AND my_role() = 'admin');

-- Notes : les enseignants peuvent INSERT/UPDATE sur leur école
DROP POLICY IF EXISTS "grades_teacher_write" ON grades;
CREATE POLICY "grades_teacher_write" ON grades FOR INSERT WITH CHECK (
  school_id = my_school_id() AND my_role() = 'teacher'
);
DROP POLICY IF EXISTS "grades_teacher_update" ON grades;
CREATE POLICY "grades_teacher_update" ON grades FOR UPDATE USING (
  school_id = my_school_id() AND my_role() = 'teacher'
);

-- Appel : les enseignants peuvent enregistrer les présences de leurs classes
DROP POLICY IF EXISTS "attendance_teacher_write" ON attendance;
CREATE POLICY "attendance_teacher_write" ON attendance FOR INSERT WITH CHECK (
  school_id = my_school_id() AND my_role() = 'teacher'
);
DROP POLICY IF EXISTS "attendance_teacher_update" ON attendance;
CREATE POLICY "attendance_teacher_update" ON attendance FOR UPDATE USING (
  school_id = my_school_id() AND my_role() = 'teacher'
);
DROP POLICY IF EXISTS "attendance_admin_delete" ON attendance;
CREATE POLICY "attendance_admin_delete" ON attendance FOR DELETE USING (
  school_id = my_school_id() AND my_role() = 'admin'
);

-- ============================================================
-- SECTION 13 : FONCTIONS RPC
-- ============================================================

DROP FUNCTION IF EXISTS teacher_directory() CASCADE;
-- Annuaire enseignants (pour l'espace prof)
CREATE OR REPLACE FUNCTION teacher_directory()
RETURNS TABLE(id BIGINT, full_name TEXT, subject TEXT, school_id BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, full_name, subject, school_id
  FROM teachers
  WHERE school_id = my_school_id()
  ORDER BY full_name;
$$;

DROP FUNCTION IF EXISTS my_class_ranks() CASCADE;
-- Rang de l'élève connecté dans sa classe (par semestre)
CREATE OR REPLACE FUNCTION my_class_ranks()
RETURNS TABLE(semester TEXT, rank BIGINT, total BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_school BIGINT := my_school_id();
  v_mat    TEXT := my_matricule();
  v_sid    BIGINT;
  v_cid    BIGINT;
BEGIN
  SELECT id, class_id INTO v_sid, v_cid FROM students
  WHERE school_id = v_school AND matricule = v_mat
  LIMIT 1;
  IF v_sid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH avgs AS (
    SELECT g.student_id,
           g.semester,
           SUM(g.average * s.coeff) / NULLIF(SUM(CASE WHEN g.average IS NOT NULL THEN s.coeff ELSE 0 END), 0) AS gen_avg
    FROM grades g
    JOIN subjects s ON s.id = g.subject_id
    WHERE g.school_id = v_school
      AND g.student_id IN (SELECT id FROM students WHERE class_id = v_cid)
    GROUP BY g.student_id, g.semester
  ),
  ranked AS (
    SELECT student_id, semester,
           RANK() OVER (PARTITION BY semester ORDER BY gen_avg DESC NULLS LAST) AS rnk,
           COUNT(*) OVER (PARTITION BY semester) AS total
    FROM avgs
  )
  SELECT r.semester, r.rnk, r.total
  FROM ranked r
  WHERE r.student_id = v_sid;
END;
$$;

-- ============================================================
-- SECTION 14 : DONNÉES D'EXEMPLE (1ère école)
-- !! Exécutez ceci UNIQUEMENT pour créer votre première école !!
-- !! Remplacez les valeurs par les infos réelles de l'école.  !!
-- ============================================================

INSERT INTO schools (slug, name, short_name, city, phone, email, ia, ief, school_year, currency, country)
VALUES (
  'al-amine-touba',          -- ← slug unique (utilisé dans school_config.js)
  'Groupe Scolaire Al-Amine',
  'Al-Amine',
  'Touba Mosquée',
  '+221 33 800 00 00',
  'contact@alamine-touba.sn',
  'IA Diourbel',
  'IEF Touba',
  '2025 - 2026',
  'FCFA',
  'Sénégal'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SECTION 15 : COMPTES ADMINISTRATEURS (multi-administrateurs)
-- Vous pouvez avoir autant d'administrateurs que nécessaire pour l'école.
--
-- Option A : Depuis l'application SunuSchool (recommandé une fois le 1er admin créé)
--   Connectez-vous avec n'importe quel compte admin, puis allez dans :
--   ⚙️ Paramètres → 👥 Administrateurs de l'Établissement → "Nouveau Compte Administrateur".
--
-- Option B : Premier administrateur (via Supabase Dashboard)
--   1. Allez dans Authentication → Users → Add User (Create User)
--      Email : adm-2025-001@al-amine-touba.sunuschool.app (ou votre email / format)
--      Password : votre mot de passe (min 8 caractères)
--      Cochez "Auto Confirm User".
--   2. Copiez l'UUID généré et exécutez ci-dessous :
-- ============================================================

-- Exemple d'association du premier admin :
-- INSERT INTO profiles (id, school_id, role, matricule, full_name)
-- VALUES (
--   'UUID-DU-COMPTE-ADMIN',
--   (SELECT id FROM schools WHERE slug = 'al-amine-touba'),
--   'admin',
--   'ADM-2025-001',
--   'Directeur / Administrateur Principal'
-- ) ON CONFLICT (school_id, matricule) DO NOTHING;

-- ============================================================
-- SECTION 16 : INDEX POUR LES PERFORMANCES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_classes_school   ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_teachers_school  ON teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school  ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class   ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_student   ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject   ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_day   ON attendance(day);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_school  ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_school  ON profiles(school_id);
