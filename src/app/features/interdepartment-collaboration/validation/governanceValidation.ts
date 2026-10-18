import {integerError} from '../../../shared/numericValidation';
import type {CollaborationOrganizationSelection} from '../types';
export function governanceConfigurationError(organizations:CollaborationOrganizationSelection[]){
 for(const org of organizations){
  const issue=integerError(org.reviewDeadlineDays??5,'Review deadline',1,90)||integerError(org.sequence??1,'Approval sequence',1,2147483647)||integerError(org.quorumCount??1,'Quorum',1,2147483647);if(issue)return issue;
  if(org.approvalPolicy&&!['one_of','all','quorum'].includes(org.approvalPolicy))return 'Choose a valid approval policy.';
 }
 return '';
}
