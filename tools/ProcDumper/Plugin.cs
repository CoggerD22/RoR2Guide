using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using BepInEx;
using BepInEx.Logging;
using HarmonyLib;
using RoR2;
using UnityEngine;

namespace ProcDumper
{
    /// <summary>
    /// Records the proc coefficient the game ACTUALLY uses, and which EntityState was
    /// running when it fired. This is observed behaviour, not static inference — it is
    /// the one source that can settle skills our decompile analysis cannot reach
    /// (see MATH-VERIFICATION.md Phase 5).
    ///
    /// Output: BepInEx/proc-dump.csv, one row per attack fired.
    ///   kind, proc, attackerBody, machine, state
    ///
    /// KNOWN LIMITS — read before trusting a row:
    ///  * PROJECTILES ARE NOT HOOKED. Verified against the decompile: FireProjectileInfo
    ///    has no procCoefficient field — a projectile's proc lives on its prefab's
    ///    ProjectileController and is not passed at fire time. That value is already
    ///    captured statically by scripts/extract-loadouts.py, so there is nothing new to
    ///    observe here. (A future enhancement could hook the projectile's own impact to
    ///    CONFIRM the prefab value; that's a different hook and is left for later.)
    ///  * ATTRIBUTION: we log every EntityStateMachine on the attacker and its current
    ///    state, rather than guessing which one is responsible. Read the rows; don't
    ///    assume the first machine is the cause.
    ///  * COVERAGE: only records the bullet/overlap/blast attacks of skills you actually
    ///    fire in-game. These are exactly the hitscan/melee cases static analysis handles
    ///    worst, so this is the useful complement to the static data.
    ///  * MULTI-HIT / DOT: repeating attacks log a row per fire, which is correct but
    ///    means volume varies wildly between skills.
    /// </summary>
    [BepInPlugin(Guid, "RoR2 Companion Proc Dumper", "1.0.0")]
    public class Plugin : BaseUnityPlugin
    {
        public const string Guid = "com.ror2guide.procdumper";

        internal static ManualLogSource Log;
        private static string _csvPath;
        private static readonly object Gate = new object();
        // Only write a row when this (state, kind, proc) combination is new — otherwise
        // a minigun-style primary would produce tens of thousands of identical lines.
        private static readonly HashSet<string> Seen = new HashSet<string>();

        private void Awake()
        {
            Log = Logger;
            try
            {
                // Fully qualified: RoR2 also defines a `Path` type, so bare `Path` is ambiguous.
                _csvPath = System.IO.Path.Combine(Paths.BepInExRootPath, "proc-dump.csv");
                if (!File.Exists(_csvPath))
                    File.WriteAllText(_csvPath, "kind,proc,attackerBody,machine,state\n", Encoding.UTF8);

                new Harmony(Guid).PatchAll(typeof(Plugin).Assembly);
                Log.LogInfo("Proc Dumper active. Writing to " + _csvPath);
                Log.LogInfo("Fire each skill once; every new (state, proc) pair is recorded.");
            }
            catch (Exception e)
            {
                Log.LogError("Proc Dumper failed to start: " + e);
            }
        }

        /// <summary>Every state machine on the attacker, with its current state.</summary>
        private static List<KeyValuePair<string, string>> StatesOf(GameObject attacker)
        {
            var result = new List<KeyValuePair<string, string>>();
            if (attacker == null) return result;
            var machines = attacker.GetComponents<EntityStateMachine>();
            if (machines == null) return result;
            foreach (var m in machines)
            {
                if (m == null || m.state == null) continue;
                var name = string.IsNullOrEmpty(m.customName) ? "(unnamed)" : m.customName;
                result.Add(new KeyValuePair<string, string>(name, m.state.GetType().FullName));
            }
            return result;
        }

        private static string BodyName(GameObject attacker)
        {
            if (attacker == null) return "(null)";
            var body = attacker.GetComponent<CharacterBody>();
            return body != null ? body.name : attacker.name;
        }

        internal static void Record(string kind, float proc, GameObject attacker)
        {
            try
            {
                var body = BodyName(attacker);
                var states = StatesOf(attacker);
                if (states.Count == 0)
                {
                    Write(kind, proc, body, "(none)", "(no active state)");
                    return;
                }
                foreach (var s in states) Write(kind, proc, body, s.Key, s.Value);
            }
            catch (Exception e)
            {
                Log?.LogWarning("Proc Dumper record failed: " + e.Message);
            }
        }

        private static void Write(string kind, float proc, string body, string machine, string state)
        {
            var procText = proc.ToString("0.####", CultureInfo.InvariantCulture);
            var key = state + "|" + kind + "|" + procText + "|" + machine;
            lock (Gate)
            {
                if (!Seen.Add(key)) return;
                File.AppendAllText(
                    _csvPath,
                    string.Join(",", new[] { kind, procText, body, machine, state }) + "\n",
                    Encoding.UTF8);
            }
            Log?.LogInfo($"[proc] {procText,-5} {kind,-10} {state}");
        }
    }

    // ---- Harmony patches. Signatures verified against the decompiled RoR2.dll. ----
    // All are Prefixes that only read state, so a failure here cannot alter gameplay.

    [HarmonyPatch(typeof(BulletAttack), nameof(BulletAttack.Fire), new Type[0])]
    internal static class Patch_BulletAttack
    {
        private static void Prefix(BulletAttack __instance)
            => Plugin.Record("bullet", __instance.procCoefficient, __instance.owner);
    }

    [HarmonyPatch(typeof(OverlapAttack), nameof(OverlapAttack.Fire))]
    internal static class Patch_OverlapAttack
    {
        private static void Prefix(OverlapAttack __instance)
            => Plugin.Record("overlap", __instance.procCoefficient, __instance.attacker);
    }

    [HarmonyPatch(typeof(BlastAttack), nameof(BlastAttack.Fire))]
    internal static class Patch_BlastAttack
    {
        private static void Prefix(BlastAttack __instance)
            => Plugin.Record("blast", __instance.procCoefficient, __instance.attacker);
    }

    // No projectile patch: FireProjectileInfo carries no procCoefficient (verified in
    // the decompile). Projectile procs are prefab-defined and already extracted
    // statically, so there is nothing to observe at fire time.
}
