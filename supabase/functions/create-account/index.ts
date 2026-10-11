// @ts-nocheck
// ================================================================
//  SunuSchool — Edge Function : create-account
//  Supabase Functions → create-account/index.ts
//
//  Usages :
//  1. action: "create" (ou par défaut) → Crée un nouveau compte (élève, prof, admin)
//     - Crée l'utilisateur Supabase Auth
//     - Crée le profil dans "profiles"
//     - Enregistre dans la table "students" ou "teachers" selon le rôle
//  2. action: "reset"  → Réinitialise le mot de passe d'un compte existant
//  3. action: "delete" → Supprime un élève ou enseignant et son compte Auth
//
//  ⚠️  Cette fonction utilise la clé service_role (admin Supabase).
//      Elle ne doit être appelée que par des utilisateurs ADMIN authentifiés.
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Réponse aux requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // ── 1. Créer le client Supabase Admin (service_role) ───────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── 2. Vérifier que l'appelant est un admin authentifié ─────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Non autorisé : connexion requise.' }, 401);
    }

    // Créer un client "utilisateur" pour vérifier le JWT de l'appelant
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return json({ error: 'Token invalide ou expiré.' }, 401);
    }

    // Vérifier que l'appelant a bien le rôle "admin" dans sa propre école
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single();

    if (profErr || !profile || profile.role !== 'admin') {
      return json({ error: 'Accès refusé : réservé aux administrateurs.' }, 403);
    }

    const schoolId = profile.school_id;

    // ── 3. Lire le corps de la requête ─────────────────────────────────
    const body = await req.json();
    let { action, matricule, role, full_name, password } = body;

    // Déduction de l'action par défaut si non fournie
    if (!action && (role === 'student' || role === 'teacher' || role === 'admin' || full_name)) {
      action = 'create';
    }

    if (!action) {
      return json({ error: 'Action requise : "create", "reset" ou "delete".' }, 400);
    }

    // ── 4. Informations de l'école ──────────────────────────────────────
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('slug, school_year')
      .eq('id', schoolId)
      .single();

    if (!school) return json({ error: 'École introuvable.' }, 404);

    const currentYear = new Date().getFullYear();
    const emailDomain = school.slug + '.sunuschool.app';

    // ── 5. Exécuter l'action ──────────────────────────────────────────
    if (action === 'create') {
      role = role || 'student';

      // Auto-génération de matricule si non renseigné
      let finalMatricule = String(matricule || '').trim().toUpperCase();
      if (!finalMatricule) {
        if (role === 'student') {
          const { data: existingStudents } = await supabaseAdmin
            .from('students')
            .select('matricule')
            .eq('school_id', schoolId);

          let maxNum = 0;
          (existingStudents || []).forEach(s => {
            const m = String(s.matricule || '').match(/(\d+)$/);
            if (m) {
              const val = parseInt(m[1], 10);
              if (val > maxNum) maxNum = val;
            }
          });
          finalMatricule = `SN-${currentYear}-${String(maxNum + 1).padStart(4, '0')}`;
        } else if (role === 'teacher') {
          const { data: existingTeachers } = await supabaseAdmin
            .from('teachers')
            .select('matricule')
            .eq('school_id', schoolId);

          let maxNum = 0;
          (existingTeachers || []).forEach(t => {
            const m = String(t.matricule || '').match(/(\d+)$/);
            if (m) {
              const val = parseInt(m[1], 10);
              if (val > maxNum) maxNum = val;
            }
          });
          finalMatricule = `ENS-${currentYear}-${String(maxNum + 1).padStart(3, '0')}`;
        } else if (role === 'admin') {
          const { data: existingAdmins } = await supabaseAdmin
            .from('profiles')
            .select('matricule')
            .eq('school_id', schoolId)
            .eq('role', 'admin');

          let maxNum = 0;
          (existingAdmins || []).forEach(a => {
            const m = String(a.matricule || '').match(/(\d+)$/);
            if (m) {
              const val = parseInt(m[1], 10);
              if (val > maxNum) maxNum = val;
            }
          });
          finalMatricule = `ADM-${currentYear}-${String(maxNum + 1).padStart(3, '0')}`;
        } else {
          finalMatricule = `USR-${currentYear}-${Date.now().toString().slice(-4)}`;
        }
      }

      const email = finalMatricule.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '@' + emailDomain;

      // Générer mot de passe si non fourni
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const genPassword = () => Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const finalPassword = (password && password.length >= 8) ? password : genPassword();

      // Vérifier si un compte Auth avec cet email existe déjà
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      let authUser = (listData?.users || []).find(u => u.email === email);

      if (!authUser) {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: finalPassword,
          email_confirm: true,
          user_metadata: { role, full_name: full_name || finalMatricule, matricule: finalMatricule, school_id: schoolId }
        });

        if (createErr) {
          if (/already.*registered|duplicate/i.test(createErr.message)) {
            return json({ error: 'Ce matricule a déjà un compte. Utilisez la réinitialisation pour changer son mot de passe.' }, 409);
          }
          return json({ error: 'Création compte Auth impossible : ' + createErr.message }, 400);
        }
        authUser = created.user;
      } else {
        // Mettre à jour le mot de passe du compte Auth existant
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          password: finalPassword,
          user_metadata: { role, full_name: full_name || finalMatricule, matricule: finalMatricule, school_id: schoolId }
        });
      }

      // Créer ou mettre à jour le profil
      const { error: profInsertErr } = await supabaseAdmin.from('profiles').upsert({
        id: authUser.id,
        school_id: schoolId,
        role: role,
        matricule: finalMatricule,
        full_name: full_name || finalMatricule
      }, { onConflict: 'school_id,matricule' });

      if (profInsertErr) {
        return json({ error: 'Compte créé mais échec profil : ' + profInsertErr.message }, 500);
      }

      // Insertion dans la table métier correspondante
      if (role === 'student') {
        const studentRow = {
          school_id: schoolId,
          matricule: finalMatricule,
          full_name: full_name || finalMatricule,
          class_id: body.class_id ? Number(body.class_id) : null,
          sex: body.sex || null,
          parent_name: body.parent_name || null,
          phone: body.phone || null,
          monthly_fee: parseInt(body.monthly_fee, 10) || 0
        };
        const { error: studErr } = await supabaseAdmin
          .from('students')
          .upsert(studentRow, { onConflict: 'school_id,matricule' });

        if (studErr) {
          console.error('Erreur insertion table students:', studErr);
          return json({ error: 'Compte créé mais inscription élève échouée : ' + studErr.message }, 500);
        }
      } else if (role === 'teacher') {
        const teacherRow = {
          school_id: schoolId,
          matricule: finalMatricule,
          full_name: full_name || finalMatricule,
          subject: body.subject || '',
          phone: body.phone || null,
          coeff: Number(body.coeff) || 1.0
        };
        const { error: teachErr } = await supabaseAdmin
          .from('teachers')
          .upsert(teacherRow, { onConflict: 'school_id,matricule' });

        if (teachErr) {
          console.error('Erreur insertion table teachers:', teachErr);
          return json({ error: 'Compte créé mais enregistrement enseignant échoué : ' + teachErr.message }, 500);
        }
      }

      return json({
        success: true,
        matricule: finalMatricule,
        full_name: full_name || finalMatricule,
        role,
        password: finalPassword,
        email
      });

    } else if (action === 'reset') {
      if (!matricule) {
        return json({ error: 'Matricule requis pour réinitialiser le mot de passe.' }, 400);
      }
      const targetMat = matricule.trim().toUpperCase();
      const email = targetMat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '@' + emailDomain;

      // Trouver l'utilisateur
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const targetUser = users?.users?.find(u => u.email === email);

      if (!targetUser) {
        return json({ error: `Aucun compte trouvé pour le matricule "${targetMat}".` }, 404);
      }

      // Vérifier que cet utilisateur appartient à la même école
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('school_id, full_name, role')
        .eq('id', targetUser.id)
        .single();

      if (!targetProfile || targetProfile.school_id !== schoolId) {
        return json({ error: 'Ce compte n\'appartient pas à votre école.' }, 403);
      }

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const genPassword = () => Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const finalPassword = (password && password.length >= 8) ? password : genPassword();

      // Changer le mot de passe
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: finalPassword
      });

      if (updateErr) return json({ error: updateErr.message }, 400);

      return json({
        success: true,
        matricule: targetMat,
        full_name: targetProfile.full_name,
        role: targetProfile.role,
        password: finalPassword
      });

    } else if (action === 'delete') {
      if (!matricule) {
        return json({ error: 'Matricule requis pour supprimer un compte.' }, 400);
      }
      const targetMat = matricule.trim().toUpperCase();
      const email = targetMat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '@' + emailDomain;

      // 1. Supprimer de la table métier
      if (role === 'student' || !role) {
        await supabaseAdmin.from('students').delete().eq('school_id', schoolId).eq('matricule', targetMat);
      }
      if (role === 'teacher' || !role) {
        await supabaseAdmin.from('teachers').delete().eq('school_id', schoolId).eq('matricule', targetMat);
      }

      // 2. Trouver et supprimer le compte Auth + profil
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const targetUser = users?.users?.find(u => u.email === email);

      if (targetUser) {
        await supabaseAdmin.from('profiles').delete().eq('id', targetUser.id);
        await supabaseAdmin.auth.admin.deleteUser(targetUser.id);
      } else {
        await supabaseAdmin.from('profiles').delete().eq('school_id', schoolId).eq('matricule', targetMat);
      }

      return json({
        success: true,
        matricule: targetMat,
        message: 'Compte et données supprimés avec succès.'
      });

    } else {
      return json({ error: `Action inconnue : "${action}". Utilisez "create", "reset" ou "delete".` }, 400);
    }

  } catch (err) {
    console.error('create-account error:', err);
    return json({ error: String(err?.message || err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}
