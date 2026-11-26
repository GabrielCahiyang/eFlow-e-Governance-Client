import { memo } from "react";
import { EFlowMark } from "../../../components/EFlowMark";
import styles from "../LandingPage.module.scss";

export interface LandingFooterProps {
  organizationName: string;
}

export const LandingFooter = memo(function LandingFooter({ organizationName }: LandingFooterProps) {
  return (
    <footer className={styles.footerSection} aria-label="eFlow footer">
      <div className={styles.footerInner}>
        <div className={styles.footerBrandLockup}>
          <EFlowMark variant="white" height={42} ariaLabel="eFlow" />
          <div className={styles.footerBrandDivider} aria-hidden="true" />
          <span className={styles.footerBrandOrg}>{organizationName}</span>
        </div>

        <p className={styles.footerCopyright}>
          © {new Date().getFullYear()} eFlow. All rights reserved.
        </p>
      </div>
    </footer>
  );
});
