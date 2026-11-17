import { useEffect, useRef, useState } from 'react';
import { get, push, ref, set } from 'firebase/database';
import { database } from '../../../../../firebase';
import { useAuth } from '../../../../contexts/AuthContext';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warn';
}

interface MigrationStats {
  departments: { total: number; migrated: number };
  employees: { total: number; migrated: number };
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-PH', { hour12: false });
}

export function useMigrationToolController() {
const { userProfile } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<MigrationStats>({
    departments: { total: 0, migrated: 0 },
    employees: { total: 0, migrated: 0 },
  });
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log panel
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { timestamp: timestamp(), message, type }]);
  };

  // Safety check: does /users already have data?
  useEffect(() => {
    (async () => {
      try {
        const snap = await get(ref(database, "users"));
        if (snap.exists()) {
          const data = snap.val();
          const count = typeof data === "object" ? Object.keys(data).length : 0;
          if (count > 0) {
            setBlocked(true);
            addLog(
              `[BLOCKED] /users node already contains ${count} entries. Migration is stopped to prevent duplicates.`,
              "error"
            );
          }
        }
      } catch (err: any) {
        addLog(`[WARN] Could not check /users node: ${err.message}`, "warn");
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  // ─── MIGRATION LOGIC ────────────────────────────────────────────
  const runMigration = async () => {
    setRunning(true);
    setProgress(0);
    addLog("[START] Starting migration...", "info");

    try {
      // ── Step 1: Read departments array ──
      addLog("[READ] Reading /offices list...", "info");
      const deptSnap = await get(ref(database, "departments"));

      if (!deptSnap.exists()) {
        addLog("[WARN] /offices node is empty or does not exist.", "warn");
      }

      const deptArray: any[] = deptSnap.val() || [];
      const validDepts = Array.isArray(deptArray)
        ? deptArray.filter(Boolean)
        : Object.values(deptArray);

      addLog(`  Found ${validDepts.length} offices`, "info");
      setStats((s) => ({
        ...s,
        departments: { total: validDepts.length, migrated: 0 },
      }));

      // ── Step 2: Rewrite departments as keyed object ──
      addLog("[MIGRATE] Moving offices to /offices/{id}...", "info");
      for (let i = 0; i < validDepts.length; i++) {
        const dept = validDepts[i];
        if (!dept || !dept.id) {
          addLog(`  [WARN] Skipping invalid office at index ${i}`, "warn");
          continue;
        }

        const deptData = {
          id: dept.id,
          name: dept.name || "",
          description: dept.description || "",
          headUid: null,
          createdAt: Date.now(),
        };

        await set(ref(database, `offices/${dept.id}`), deptData);
        addLog(`  [OK] Migrated office ${dept.id} to /offices/${dept.id}`, "success");

        setStats((s) => ({
          ...s,
          departments: { ...s.departments, migrated: s.departments.migrated + 1 },
        }));

        // Update progress (departments = 0-40%)
        setProgress(Math.round(((i + 1) / validDepts.length) * 40));
      }

      // ── Step 3: Read employees array ──
      addLog("[READ] Reading /members list...", "info");
      const empSnap = await get(ref(database, "employees"));

      if (!empSnap.exists()) {
        addLog("[WARN] /members node is empty or does not exist.", "warn");
      }

      const empArray: any[] = empSnap.val() || [];
      const validEmps = Array.isArray(empArray)
        ? empArray.filter(Boolean)
        : Object.values(empArray);

      addLog(`  Found ${validEmps.length} members`, "info");
      setStats((s) => ({
        ...s,
        employees: { total: validEmps.length, migrated: 0 },
      }));

      // ── Step 4: Write employees to /users/{pushKey} ──
      addLog("[MIGRATE] Moving members to /users/{uid}...", "info");

      // Track dept heads to update /departments/{id}/headUid later
      const deptHeadMap: Record<string, string> = {};

      for (let i = 0; i < validEmps.length; i++) {
        const emp = validEmps[i];
        if (!emp || !emp.id) {
          addLog(`  [WARN] Skipping invalid member at index ${i}`, "warn");
          continue;
        }

        // Generate a push key for this user
        const newUserRef = push(ref(database, "users"));
        const uid = newUserRef.key!;

        const isHead = emp.role === "Head";
        const mappedRole = isHead ? "head" : "member";

        const userData = {
          name: emp.name || "",
          email: emp.email || "",
          initials: emp.initials || "",
          role: mappedRole,
          departmentId: emp.department || "",
          employeeId: emp.id,
          isActive: true,
          createdAt: Date.now(),
        };

        await set(newUserRef, userData);
        addLog(
          `  [OK] Migrated ${emp.name} (${emp.id}) to /users/${uid} [${mappedRole}]`,
          "success"
        );

        // Track dept heads
        if (isHead && emp.department) {
          deptHeadMap[emp.department] = uid;
        }

        setStats((s) => ({
          ...s,
          employees: { ...s.employees, migrated: s.employees.migrated + 1 },
        }));

        // Update progress (employees = 40-90%)
        setProgress(40 + Math.round(((i + 1) / validEmps.length) * 50));
      }

      // ── Step 5: Link dept heads to departments ──
      addLog("[LINK] Connecting office heads...", "info");
      for (const [deptId, headUid] of Object.entries(deptHeadMap)) {
        try {
          await set(ref(database, `offices/${deptId}/headUid`), headUid);
          addLog(`  [OK] Linked ${deptId} headUid to ${headUid}`, "success");
        } catch (err: any) {
          addLog(`  [ERROR] Failed to link ${deptId}: ${err.message}`, "error");
        }
      }

      setProgress(100);
      setComplete(true);
      addLog("", "info");
      addLog("-------------------------------------------", "info");
      addLog("[DONE] Migration completed successfully.", "success");
      addLog("-------------------------------------------", "info");
    } catch (err: any) {
      addLog(`[ERROR] Migration failed: ${err.message}`, "error");
      setProgress(0);
    } finally {
      setRunning(false);
    }
  };

  // ─── Access control ──────────────────────────────────────────────

  return { blocked, checking, complete, logEndRef, logs, progress, runMigration, running, stats, userProfile };
}
