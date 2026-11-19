import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDepartmentFiscalYears, getCurrentFiscalYear } from '../../budget';
import { writeNavigationLocation } from '../../navigation';
import { createProject, notifyProjectListeners, type Project } from '../../projects';
import { ProjectFlowError, ProjectSetupWizard } from '../../project-setup';
import { useAuth } from '../../../contexts/AuthContext';
import { readableUiError } from '../../../shared/userFacingError';
import type { Organization, UserProfile } from '../../../types';
import { OfficeBudgetRequiredModal, type OfficeBudgetGateReason } from './OfficeBudgetRequiredModal';

type BudgetGateState =
  | { status: 'checking' }
  | { status: 'ready' }
  | { status: 'blocked'; reason: OfficeBudgetGateReason }
  | { status: 'error'; message: string };

export function CreateProjectDialog({
  open,
  importPdf = false,
  onClose,
  onCreated,
  officeId,
  officeName,
  profiles = [],
  profilesLoading,
  organizations,
}: {
  open: boolean;
  importPdf?: boolean;
  onClose: () => void;
  onCreated: (p: Project, ready?: boolean) => void;
  officeId: string;
  officeName?: string;
  ownerName?: string;
  profiles?: UserProfile[];
  profilesLoading?: boolean;
  organizations: Organization[];
}) {
  const created = useRef<Project | undefined>(undefined);
  const { user, can } = useAuth();
  const currentYear = getCurrentFiscalYear();
  const [gate, setGate] = useState<BudgetGateState>({ status: 'checking' });
  const checkVersion = useRef(0);

  const checkOfficeBudget = useCallback(async () => {
    const version = ++checkVersion.current;
    if (!officeId) {
      setGate({ status: 'blocked', reason: 'missing' });
      return;
    }
    setGate({ status: 'checking' });
    try {
      const years = await fetchDepartmentFiscalYears(officeId);
      if (checkVersion.current !== version) return;
      const current = years.find((row) => row.year === currentYear);
      if (!current) {
        setGate({ status: 'blocked', reason: 'missing' });
      } else if (current.status === 'locked') {
        setGate({ status: 'ready' });
      } else if (current.status === 'closed') {
        setGate({ status: 'blocked', reason: 'closed' });
      } else {
        setGate({ status: 'blocked', reason: 'draft' });
      }
    } catch (error) {
      if (checkVersion.current !== version) return;
      setGate({
        status: 'error',
        message: readableUiError(error, 'We could not verify this year’s Office Budget.', 'read'),
      });
    }
  }, [currentYear, officeId]);

  useEffect(() => {
    if (!open) return;
    void checkOfficeBudget();
    return () => {
      checkVersion.current += 1;
    };
  }, [open, checkOfficeBudget]);

  const recoveryKey = user && officeId ? `eflow:project-draft:${user.id}:${officeId}` : '';

  async function close(id?: string, ready?: boolean) {
    if (id) {
      const project =
        created.current?.id === id
          ? created.current
          : (await notifyProjectListeners()).find((item) => item.id === id);
      if (project) onCreated(project, ready);
    }
    onClose();
  }

  const openOfficeBudgetSetup = () => {
    onClose();
    writeNavigationLocation('budget', 'Office Budget', 'push', {
      parameters: { view: 'annual', fy: String(currentYear) },
    });
  };

  if (!open) return null;

  if (gate.status !== 'ready') {
    return (
      <OfficeBudgetRequiredModal
        isOpen
        fiscalYear={currentYear}
        reason={gate.status === 'blocked' ? gate.reason : 'missing'}
        importPdf={importPdf}
        loading={gate.status === 'checking'}
        error={gate.status === 'error' ? gate.message : ''}
        canConfigureBudget={can('navigation.department_budgets')}
        onRetry={() => void checkOfficeBudget()}
        onConfigureBudget={openOfficeBudgetSetup}
        onClose={onClose}
      />
    );
  }

  return (
    <ProjectSetupWizard
      key={recoveryKey}
      recoveryKey={recoveryKey}
      importPdf={importPdf}
      creatorId={user?.id}
      profiles={profiles.filter((person) => person.org_id === officeId)}
      profilesLoading={profilesLoading}
      organizations={organizations}
      officeName={officeName}
      createDraft={async (title, requestId) => {
        try {
          const project = await createProject(
            { title, orgId: officeId, status: 'planning', sourceType: 'manual' },
            requestId,
          );
          created.current = project;
          return project.id;
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            typeof error.code === 'string' &&
            /^(22|23|28|42)[0-9A-Z]{3}$/.test(error.code)
          ) {
            throw new ProjectFlowError(
              'Project creation was rejected. Check your Office access and project details, then retry.',
              error.code,
            );
          }
          throw error;
        }
      }}
      onClose={(id) => void close(id)}
      onFinish={(id) => void close(id, true)}
    />
  );
}
