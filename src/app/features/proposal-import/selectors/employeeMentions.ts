import type { Employee } from "../../../services/employeeService";
import type { Organization } from "../../../types";
import { getDescendantOrgIds } from "../../../../lib/supabaseService";

export function filterEmployeesByPdfMentions(
  pdfText: string,
  allEmployees: Employee[],
  orgs: Organization[]
): Employee[] {
  if (!allEmployees || allEmployees.length === 0) return [];
  
  const textUpper = pdfText.toUpperCase();
  
  const mentionedOrgs = orgs.filter((org) => {
    const nameMatch = org.name && textUpper.includes(org.name.toUpperCase());
    const slugMatch = org.slug && textUpper.includes(org.slug.toUpperCase());
    
    let acronymMatch = false;
    if (org.slug === "ledip" || org.slug === "ledipo") {
      acronymMatch = textUpper.includes("LEDIP") || textUpper.includes("LEDIPO");
    } else if (org.slug === "cpdo") {
      acronymMatch = textUpper.includes("CPDO");
    } else if (org.slug === "bplo") {
      acronymMatch = textUpper.includes("BPLO") || textUpper.includes("BUSINESS PERMITS");
    } else if (org.slug === "ociib") {
      acronymMatch = textUpper.includes("OCIIB") || textUpper.includes("INCENTIVES BOARD");
    }
    
    return nameMatch || slugMatch || acronymMatch;
  });

  if (mentionedOrgs.length === 0) {
    console.log("[PDF Scope Filter] No matching proponents found in PDF. Using all members.");
    return allEmployees;
  }

  const allowedOrgIds = new Set<string>();
  mentionedOrgs.forEach((org) => {
    const descendants = getDescendantOrgIds(orgs, org.id);
    descendants.forEach((id) => allowedOrgIds.add(id));
  });

  console.log("[PDF Scope Filter] Mentioned Orgs:", mentionedOrgs.map(o => o.name));
  console.log("[PDF Scope Filter] Allowed Org IDs:", Array.from(allowedOrgIds));

  const filtered = allEmployees.filter((emp) => {
    return emp.department && allowedOrgIds.has(emp.department);
  });

  console.log("[PDF Scope Filter] Filtered Members:", filtered.map(e => e.name));
  return filtered;
}

// ─── Types ────────────────────────────────────────────────────────
