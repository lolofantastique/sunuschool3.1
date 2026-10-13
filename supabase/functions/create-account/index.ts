import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DOMAIN = "sunuschool.example.com";
const emailOf = (m: string) => m.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "@" + DOMAIN;

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(10);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

const clean = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // 1. L'appelant doit être connecté ET administrateur (vérifié côté serveur).
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u, error: ue } = await caller.auth.getUser();
  if (ue || !u?.user) return json({ error: "Non connecté." }, 401);
  const { data: prof } = await caller.from("profiles").select("role, school_id, is_director").eq("id", u.user.id).maybeSingle();
  if (prof?.role !== "admin") return json({ error: "Réservé à l'administration." }, 403);
  const schoolId = prof.school_id;
  if (!schoolId) return json({ error: "Votre compte n'est rattaché à aucune école." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.action === "reset" || body.action === "delete") {
    const matricule = clean(body.matricule, 40).toUpperCase();
    const { data: p } = await admin.from("profiles").select("id, role, full_name").eq("matricule", matricule).maybeSingle();
    if (!p) return json({ error: "Matricule introuvable." }, 404);
    if (body.action === "reset") {
      const custom = typeof body.password === "string" ? body.password : "";
      if (custom && (custom.length < 8 || custom.length > 72)) return json({ error: "Le mot de passe doit contenir entre 8 et 72 caractères." }, 400);
      const password = custom || randomPassword();
      const { error: re } = await admin.auth.admin.updateUserById(p.id, { password });
      if (re) return json({ error: "Réinitialisation impossible : " + re.message }, 500);
      return json({ ok: true, matricule, password, full_name: p.full_name, role: p.role });
    }
    if (p.role === "admin") return json({ error: "Un compte administrateur ne peut pas être supprimé ici." }, 403);
    const delTable = p.role === "student" ? "students" : "teachers";
    const { error: de } = await admin.from(delTable).delete().eq("user_id", p.id);
    if (de) return json({ error: "Suppression impossible : cet enregistrement a des données liées (notes, absences, paiements, cours). " + de.message }, 409);
    await admin.from("profiles").delete().eq("id", p.id);
    await admin.auth.admin.deleteUser(p.id);
    return json({ ok: true, matricule });
  }

  const role = body.role === "teacher" ? "teacher" : body.role === "student" ? "student" : body.role === "admin" ? "admin" : null;
  if (!role) return json({ error: "Rôle inconnu." }, 400);

  // Seul le directeur (is_director) peut créer d'autres administrateurs.
  if (role === "admin" && prof.is_director !== true) return json({ error: "Seul le directeur peut créer un administrateur." }, 403);

  const fullName = clean(body.full_name);
  if (fullName.length < 3) return json({ error: "Nom complet obligatoire." }, 400);

  // La classe choisie doit appartenir à l'école de l'administrateur.
  if (role === "student" && body.class_id) {
    const { data: cls } = await admin.from("classes").select("id").eq("id", Number(body.class_id)).eq("school_id", schoolId).maybeSingle();
    if (!cls) return json({ error: "Classe introuvable dans votre école." }, 400);
  }

  const table = role === "student" ? "students" : role === "teacher" ? "teachers" : "profiles";
  const prefix = role === "student" ? "SN-2025-" : role === "teacher" ? "ENS-2025-" : "ADM-";
  const width = role === "student" ? 4 : 3;

  for (let attempt = 0; attempt < 4; attempt++) {
    // 2. Prochain matricule libre
    const { data: rows, error: me } = await admin.from(table).select("matricule").like("matricule", prefix + "%");
    if (me) return json({ error: "Lecture des matricules impossible : " + me.message }, 500);
    const max = Math.max(0, ...(rows ?? []).map((r: { matricule: string }) => parseInt(r.matricule.slice(prefix.length), 10) || 0));
    const matricule = prefix + String(max + 1 + attempt).padStart(width, "0");
    const password = randomPassword();

    // 3. Compte de connexion
    const { data: created, error: ce } = await admin.auth.admin.createUser({
      email: emailOf(matricule), password, email_confirm: true,
      user_metadata: { matricule, role },
    });
    if (ce || !created?.user) {
      if (/already|exists|registered/i.test(ce?.message ?? "")) continue;
      return json({ error: "Création du compte impossible : " + (ce?.message ?? "inconnue") }, 500);
    }
    const uid = created.user.id;
    const rollback = async () => { await admin.auth.admin.deleteUser(uid); };

    // 4. Profil + fiche
    const { error: pe } = await admin.from("profiles").insert({ id: uid, role, matricule, full_name: fullName, school_id: schoolId });
    if (pe) { await rollback(); if (/duplicate|unique/i.test(pe.message)) continue; return json({ error: pe.message }, 500); }

    // Un administrateur n'a pas de fiche supplémentaire : le profil suffit.
    if (role === "admin") return json({ ok: true, id: uid, matricule, password, full_name: fullName, role });

    let row: Record<string, unknown>;
    if (role === "student") {
      const fee = Math.max(0, Math.round(Number(body.monthly_fee) || 0));
      const sex = body.sex === "M" || body.sex === "F" ? body.sex : null;
      row = {
        user_id: uid, matricule, full_name: fullName, sex, school_id: schoolId,
        class_id: body.class_id ? Number(body.class_id) : null,
        parent_name: clean(body.parent_name) || null, phone: clean(body.phone, 30) || null,
        monthly_fee: fee,
      };
    } else {
      const coeff = Number(body.coeff) > 0 ? Number(body.coeff) : 1;
      row = {
        user_id: uid, matricule, full_name: fullName, school_id: schoolId,
        subject: clean(body.subject) || "À définir", phone: clean(body.phone, 30) || null, coeff,
      };
    }
    const { data: ins, error: ie } = await admin.from(table).insert(row).select("id").single();
    if (ie) {
      await admin.from("profiles").delete().eq("id", uid);
      await rollback();
      if (/duplicate|unique/i.test(ie.message)) continue;
      return json({ error: ie.message }, 500);
    }
    return json({ ok: true, id: ins.id, matricule, password, full_name: fullName, role });
  }
  return json({ error: "Aucun matricule libre trouvé, réessayez." }, 409);
});
